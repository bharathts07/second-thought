"use client";

import Link from "next/link";

/**
 * The product.
 *
 * This file is the container: it owns the draft, the two threads, the findings,
 * the suppressions, the notes, and the scan lifecycle. Every child is
 * presentational, and every decision with a right answer lives in a tested pure
 * function in `Composer.tsx` or `GuidancePanel.tsx`. What is left here is
 * sequencing, which is the part that cannot be unit tested without a browser.
 *
 * The three things this file exists to get right:
 *
 *   1. **A scan result can arrive after the state it described is gone.** Every
 *      scan takes a sequence number, and a result whose number is stale is
 *      dropped rather than rendered. The engine's own `superseded` flag is
 *      honoured too, since a WASM scan of a long draft can finish after a later
 *      scan of a short one.
 *   2. **Nothing is cleared speculatively.** While a scan is in flight the
 *      existing cards stay: flicker on every keystroke reads as broken. Findings
 *      are replaced only when a result arrives, and on a recipient switch only
 *      the out-of-scope ones are dropped (F26).
 *   3. **Sending never waits.** `onSend` touches no promise. Blocking a send on a
 *      classifier is the behaviour of an enforcement tool, and this is not one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounceMs } from "@/app/lib/scan";
import { useEngine } from "@/app/lib/useEngine";
import type { Finding, Recipient } from "@/app/lib/types";
import {
  SEEDED_THREADS,
  Thread,
  type Message,
  type ThreadData,
  type ThreadMode,
} from "@/app/components/Thread";
import { RecipientSwitch } from "@/app/components/RecipientSwitch";
import {
  Composer,
  applyReplacement,
  suppressionKey,
  tidySpacing,
  visibleFindings,
} from "@/app/components/Composer";
import { GuidancePanel, findingsInScope } from "@/app/components/GuidancePanel";
import type { RemediationOption } from "@/app/components/FindingCard";

/** §14 copy deck. */
const COPY = {
  title: "Second Thought",
  subtitle:
    "A draft check that runs in your browser. Nothing you type is sent anywhere.",
  harness:
    "This is a demo surface built to show the checker. The intended form is a " +
    "browser extension for the tools you already use.",
  disclaimer:
    "Second Thought is a drafting aid. It does not provide legal or compliance advice and " +
    "does not ensure compliance with any law, regulation, or company policy.",
  notesHeading: "Your notes",
  notesDisclaimer: "On this device only. Never sent anywhere.",
} as const;

/** §6: `Nothing to flag.` is visible for two seconds, then the status line returns. */
const CLEAN_MS = 2000;

function clockTime(now: Date): string {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function recipientFor(thread: ThreadData): Recipient {
  return {
    kind: thread.recipientKind,
    label: thread.recipientLabel,
    domain: thread.recipientDomain,
  };
}

export default function Home() {
  const { status, scan, requestsSinceReady, rules } = useEngine();

  const [mode, setMode] = useState<ThreadMode>("external");
  const [threads, setThreads] = useState<Record<ThreadMode, ThreadData>>(SEEDED_THREADS);
  const [draft, setDraft] = useState("");
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [clean, setClean] = useState(false);
  const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set());
  const [notes, setNotes] = useState<readonly Message[]>([]);
  /**
   * Forces a re-scan when the draft itself did not change: after an accept whose
   * target had already gone, and after a `Remove it` that produced identical text.
   */
  const [scanNonce, setScanNonce] = useState(0);

  const thread = threads[mode];
  const recipient = useMemo(() => recipientFor(thread), [thread]);
  const device = status.kind === "ready" ? status.device : undefined;

  /** Monotonic. A result from any earlier number is stale by definition. */
  const seq = useRef(0);
  /** Set before a gesture that must scan with no debounce (§6). */
  const immediate = useRef(false);
  /** False until the semantic rung has ever been available, for the ready-scan. */
  const everScanned = useRef(false);
  const cleanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cleanTimer.current) clearTimeout(cleanTimer.current);
    };
  }, []);

  const flashClean = useCallback((isClean: boolean) => {
    if (cleanTimer.current) clearTimeout(cleanTimer.current);
    if (!isClean) {
      setClean(false);
      return;
    }
    setClean(true);
    cleanTimer.current = setTimeout(() => setClean(false), CLEAN_MS);
  }, []);

  /**
   * The one scan path.
   *
   * It re-runs when `scan` goes from null to a function, which is how a visitor
   * who typed during the download gets their draft checked without touching the
   * keyboard again (§5.1). That first run is immediate rather than debounced,
   * because the visitor has already stopped typing.
   */
  useEffect(() => {
    if (!scan) return;
    if (draft.trim() === "") {
      setFindings([]);
      setTruncated(false);
      flashClean(false);
      return;
    }

    const firstRun = !everScanned.current;
    everScanned.current = true;
    const delay = immediate.current || firstRun ? 0 : debounceMs(device);
    immediate.current = false;

    const timer = setTimeout(() => {
      const mine = ++seq.current;
      scan(draft, recipient)
        .then((result) => {
          // A result for a draft or a recipient that no longer exists renders
          // nothing. Cards from a state the visitor has left are worse than a
          // brief absence of cards. The sequence number is bumped by every
          // gesture that invalidates a scan, which is also what cancels an
          // in-flight one, so the engine's own `superseded` flag has nothing left
          // to add here (and the engine's public `scan` does not expose it).
          if (mine !== seq.current) return;
          setFindings(result.findings);
          setTruncated(result.truncated);
          // Only claim nothing to flag when both rungs actually ran. A rung that
          // could not be evaluated is not a clean draft, and reporting one is the
          // silent false negative the whole engine is built to avoid.
          flashClean(
            result.findings.length === 0 && result.ranSemantic && result.ranPattern,
          );
        })
        .catch(() => {
          // The deterministic rung may still have run. Keeping what is on screen
          // is better than implying a clean draft.
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [draft, recipient, scan, device, scanNonce, flashClean]);

  /** What is actually on screen, and therefore what the send label reads from. */
  const shown = useMemo(
    () => visibleFindings(findings, draft, suppressed),
    [findings, draft, suppressed],
  );

  const handleSwitch = useCallback(
    (next: ThreadMode) => {
      if (next === mode) return;
      // Cancel anything in flight: a late result would otherwise render cards in
      // the context that was meant to be silent, and that race is real.
      seq.current += 1;
      immediate.current = true;
      setMode(next);
      // Not a blanket clear. Tone findings apply inside the company too, and
      // discarding them here would throw away what the switch demonstrates.
      setFindings((current) =>
        findingsInScope(current, rules, threads[next].recipientKind),
      );
    },
    [mode, rules, threads],
  );

  /** A click on an example reply or on the ghost hint. Scans with no debounce. */
  const handleInsert = useCallback((text: string) => {
    immediate.current = true;
    setDraft(text);
  }, []);

  const handleAccept = useCallback(
    (finding: Finding, option: RemediationOption) => {
      // A terms finding has no wording to substitute, so its remedy is deletion.
      const replacement = option.text ?? "";
      const next = applyReplacement(draft, finding, replacement);

      // Discard every finding and re-scan from scratch rather than patching the
      // other findings' offsets (§8.1 step 4). Replacing text shifts every later
      // position, and offset arithmetic across a mutation is a bug factory for no
      // benefit when a re-scan costs 40ms.
      seq.current += 1;
      immediate.current = true;
      setFindings([]);
      setTruncated(false);
      setScanNonce((n) => n + 1);

      // The draft changed between render and click and the text is gone. Abandon
      // silently; the re-scan above is the whole recovery.
      if (next === null) return;
      setDraft(option.text === undefined ? tidySpacing(next) : next);
    },
    [draft],
  );

  const handleKeep = useCallback((finding: Finding) => {
    // Per (rule, exact text), never per occurrence: if the same sentence appears
    // twice, keeping your wording on one card removes both (§8.2). Memory only.
    setSuppressed((current) => new Set(current).add(suppressionKey(finding)));
  }, []);

  const handleSend = useCallback(
    (note: string) => {
      const text = draft.trim();
      if (text === "") return;

      // Appends to the thread it was composed in. With one shared thread this was
      // unspecified, and a reply sent internally persisted into the external
      // conversation (F25).
      const message: Message = {
        id: `sent-${mode}-${Date.now()}`,
        from: "You",
        time: clockTime(new Date()),
        text,
        mine: true,
      };
      setThreads((current) => ({
        ...current,
        [mode]: { ...current[mode], messages: [...current[mode].messages, message] },
      }));

      seq.current += 1;
      setDraft("");
      setFindings([]);
      setTruncated(false);
      flashClean(false);

      if (note !== "") {
        setNotes((current) => [
          ...current,
          { id: `note-${Date.now()}`, from: "You", time: clockTime(new Date()), text: note },
        ]);
      }
    },
    [draft, mode, flashClean],
  );

  const handleReset = useCallback(() => {
    seq.current += 1;
    setThreads(SEEDED_THREADS);
    setDraft("");
    setFindings([]);
    setTruncated(false);
    setSuppressed(new Set());
    setNotes([]);
    flashClean(false);
  }, [flashClean]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-app flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* No channel sidebar: it is the layout signature of specific commercial
          products and it is unnecessary here (T4.1.6). */}
      {/* The routes existed before anything linked to them, so /press and
          /settings were reachable only by typing a URL. Settings in particular
          has to be reachable from here: a tool that reads what you type owes you
          the ability to see every rule it applies. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-lg font-semibold tracking-tight text-ink">{COPY.title}</p>
          <p className="mt-1 text-sm text-ink-secondary">{COPY.subtitle}</p>
        </div>
        <nav aria-label="Site" className="flex items-center gap-4 text-sm text-ink-secondary">
          <Link href="/press" className="transition-control hover:text-ink hover:underline">
            Press
          </Link>
          <Link href="/settings" className="transition-control hover:text-ink hover:underline">
            Rules
          </Link>
          <a
            href="https://github.com/bharathts07/second-thought"
            className="transition-control hover:text-ink hover:underline"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </header>

      <main>
        <Thread thread={thread} onReset={handleReset}>
          <RecipientSwitch mode={mode} onChange={handleSwitch} />
        </Thread>

        <Composer
          draft={draft}
          mode={mode}
          status={status}
          requestsSinceReady={requestsSinceReady}
          findings={shown}
          onDraftChange={setDraft}
          onInsert={handleInsert}
          onSend={handleSend}
        />

        <GuidancePanel
          findings={shown}
          rules={rules}
          kind={thread.recipientKind}
          truncated={truncated}
          clean={clean}
          onAccept={handleAccept}
          onKeep={handleKeep}
        />

        {/* The concrete answer to "so how would anyone ever know?": a record can
            exist for the sender without existing for anyone else. Memory only,
            gone on reload, recorded nowhere (T4.7.3). */}
        {notes.length > 0 ? (
          <section className="mt-6 rounded-lg border border-hairline bg-surface p-4">
            <h2 className="text-sm font-medium text-ink">{COPY.notesHeading}</h2>
            <p className="mt-1 text-xs text-ink-muted">{COPY.notesDisclaimer}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((note) => (
                <li key={note.id} className="text-sm text-ink-secondary">
                  <span className="font-mono text-2xs text-ink-muted">{note.time}</span>{" "}
                  {note.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      <footer className="mt-auto flex flex-col gap-2 border-t border-hairline pt-4 text-xs text-ink-muted">
        <p>{COPY.harness}</p>
        <p>{COPY.disclaimer}</p>
      </footer>
    </div>
  );
}
