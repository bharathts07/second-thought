"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COMPANY_RULES } from "./policies";
import { createScanner } from "./scan";
import { EMBEDDING_DIMS } from "./model";
import type { DeviceKind, Embed, PolicyRule, Recipient, ScanResult } from "./types";

/**
 * The engine, as the UI sees it.
 *
 * Everything delicate about the worker lives here: construction, request
 * correlation, exemplar embedding, and the network accounting that the status
 * line's honesty depends on. The UI gets a `scan` function and a status object
 * and needs to know nothing else.
 */

export type EngineStatus =
  | { kind: "booting"; pct: number }
  | { kind: "ready"; device: DeviceKind; demoted: boolean; loadMs: number }
  | { kind: "degraded"; reason: string };

export type Engine = {
  status: EngineStatus;
  /** Null until the semantic rung is usable. Pattern checks run without it. */
  scan: ((draft: string, recipient: Recipient) => Promise<ScanResult>) | null;
  /**
   * Requests observed since `ready`, summed across every realm that can make
   * one. Null while a download is in flight, because a number the app cannot
   * vouch for is worse than no number: showing 0 beside a running download is
   * the fake zero the whole claim would die on.
   */
  requestsSinceReady: number | null;
  rules: readonly PolicyRule[];
};

type Pending = {
  resolve: (vectors: Float32Array[]) => void;
  reject: (error: Error) => void;
};

/**
 * Count fetches on the main thread. The worker counts its own and reports them,
 * because a main-thread patch cannot see another realm's `fetch` and the model
 * download happens entirely inside the worker.
 */
function installMainThreadCounter(onCount: (n: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const original = window.fetch;
  let count = 0;
  window.fetch = (...args: Parameters<typeof fetch>) => {
    onCount(++count);
    return original(...args);
  };
  return () => {
    window.fetch = original;
  };
}

export function useEngine(rules: readonly PolicyRule[] = COMPANY_RULES): Engine {
  const [status, setStatus] = useState<EngineStatus>({ kind: "booting", pct: 0 });
  const [exemplars, setExemplars] = useState<Map<string, Float32Array[]> | null>(null);
  const [mainRequests, setMainRequests] = useState(0);
  const [workerRequests, setWorkerRequests] = useState(0);
  const [inflight, setInflight] = useState(0);

  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(0);
  const startedAt = useRef(0);

  useEffect(() => {
    const restore = installMainThreadCounter(setMainRequests);
    startedAt.current = performance.now();

    /**
     * A plain same-origin path, not a bundler-resolved URL.
     *
     * `new Worker(new URL("./worker.ts", import.meta.url))` looks like the
     * canonical form and does not work here: Turbopack treats it as a static
     * asset reference and copies the TypeScript file verbatim into
     * `_next/static/media/`, where it is served as `video/mp2t` because that is
     * what `.ts` means to a web server. The browser refuses to execute it and the
     * constructor fails, which shows up as a checker stuck at 0% rather than as
     * any recognisable error.
     *
     * `scripts/build-worker.mjs` bundles it to `/worker.js` instead, so this is
     * one deterministic file the bundler never touches.
     */
    const worker = new Worker("/worker.js", { type: "module" });
    workerRef.current = worker;

    /**
     * A boot that stalls must say so.
     *
     * The worker can fail in ways that produce neither an error event nor
     * progress: a blocked model host, a CSP that forbids the fetch, a runtime the
     * browser will not instantiate. Without this the page sits at a percentage
     * forever, which reads as a broken product and, worse, leaves a visitor
     * believing checks are running when none are. Pattern checks genuinely do
     * work meanwhile, so the honest message is that wording checks are the part
     * that did not start.
     */
    const stall = setTimeout(() => {
      setStatus((prev) =>
        prev.kind === "booting"
          ? {
              kind: "degraded",
              reason: "wording checks could not start, pattern checks are still running",
            }
          : prev,
      );
    }, 90_000);

    worker.addEventListener("message", (event: MessageEvent) => {
      const data = event.data ?? {};
      switch (data.type) {
        case "progress": {
          const p = data.progress ?? {};
          if (typeof p.progress === "number") {
            setStatus((prev) =>
              prev.kind === "booting" ? { kind: "booting", pct: Math.round(p.progress) } : prev,
            );
          }
          setInflight((n) => (p.status === "done" ? Math.max(0, n - 1) : n));
          if (p.status === "initiate") setInflight((n) => n + 1);
          break;
        }
        case "net":
          setWorkerRequests(data.count ?? 0);
          setInflight(data.inflight ?? 0);
          break;
        case "ready":
          clearTimeout(stall);
          setInflight(0);
          setStatus({
            kind: "ready",
            device: data.device,
            demoted: data.demoted === true,
            loadMs: Math.round(performance.now() - startedAt.current),
          });
          break;
        case "result": {
          const p = pending.current.get(data.id);
          pending.current.delete(data.id);
          p?.resolve((data.vectors as number[][]).map((v) => new Float32Array(v)));
          break;
        }
        case "error": {
          const p = pending.current.get(data.id);
          pending.current.delete(data.id);
          p?.reject(new Error(String(data.message)));
          break;
        }
        case "fatal":
          clearTimeout(stall);
          setStatus({
            kind: "degraded",
            reason: "wording checks could not start, pattern checks are still running",
          });
          break;
        case "notice":
          // Device demotion and similar. Not user-facing on its own; the
          // following `ready` carries the state the status line shows.
          break;
      }
    });

    worker.addEventListener("error", (event) => {
      setStatus({
        kind: "degraded",
        reason: event.message || "the checker could not start in this browser",
      });
      for (const [, p] of pending.current) p.reject(new Error("worker failed"));
      pending.current.clear();
    });

    return () => {
      clearTimeout(stall);
      worker.terminate();
      workerRef.current = null;
      pending.current.clear();
      restore();
    };
  }, []);

  const embed = useCallback<Embed>((texts) => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("worker not started"));
    const id = ++nextId.current;
    return new Promise<Float32Array[]>((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      worker.postMessage({ id, type: "embed", texts });
    });
  }, []);

  /**
   * Embed every company exemplar once the encoder is up. In Milestone 1 these
   * are computed in the browser from the compiled-in rule set; the signed bundle
   * that ships precomputed vectors is a later step, so this is deliberately the
   * only path for now.
   */
  useEffect(() => {
    if (status.kind !== "ready" || exemplars) return;
    let cancelled = false;
    const semantic = rules.filter((r) => r.match.kind === "semantic");
    const texts: string[] = [];
    const owners: string[] = [];
    for (const rule of semantic) {
      if (rule.match.kind !== "semantic") continue;
      for (const exemplar of rule.match.exemplars) {
        texts.push(exemplar);
        owners.push(rule.id);
      }
    }
    if (texts.length === 0) {
      setExemplars(new Map());
      return;
    }
    embed(texts)
      .then((vectors) => {
        if (cancelled) return;
        const map = new Map<string, Float32Array[]>();
        vectors.forEach((vector, i) => {
          if (vector.length !== EMBEDDING_DIMS) return;
          const list = map.get(owners[i]) ?? [];
          list.push(vector);
          map.set(owners[i], list);
        });
        setExemplars(map);
      })
      .catch(() => {
        if (cancelled) return;
        // Pattern checks still work. Saying so is better than implying a clean
        // draft, which is what an unexplained silence would do.
        setStatus({
          kind: "degraded",
          reason: "wording checks are unavailable, pattern checks are still running",
        });
        setExemplars(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [status.kind, exemplars, rules, embed]);

  const scanner = useMemo(() => {
    if (!exemplars) return null;
    return createScanner({ embed, exemplars, rules: [...rules] });
  }, [exemplars, embed, rules]);

  const scan = useMemo(() => {
    if (!scanner) return null;
    return (draft: string, recipient: Recipient) => scanner.scan(draft, recipient);
  }, [scanner]);

  return {
    status,
    scan,
    requestsSinceReady:
      status.kind === "ready" && inflight === 0 ? mainRequests + workerRequests : null,
    rules,
  };
}
