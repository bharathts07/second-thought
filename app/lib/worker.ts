/// <reference lib="webworker" />

/**
 * The encoder, in its own worker.
 *
 * Two reasons this is a worker rather than a module on the main thread. The
 * model download is tens of megabytes and would jank the composer while it
 * lands; and inference runs on every debounced keystroke, so it must not
 * compete with React for the main thread.
 *
 * The generative rewriter, if it is ever enabled, gets a SECOND worker. Sharing
 * one would put every keystroke behind a token stream.
 */

import { env, pipeline } from "@huggingface/transformers";
import { MODEL_DTYPE, MODEL_ID, MODEL_REVISION } from "./model";
import type { DeviceKind } from "./types";

/**
 * Serve the model from our own origin, and refuse to fetch it from anywhere else.
 *
 * This is what makes `connect-src 'self'` sufficient, which in turn makes the
 * strongest form of the privacy claim literally true rather than aspirational.
 *
 * It is also the only configuration that works under the CSP. Asking the Hub for
 * weights fails: it redirects to a regional CDN host and the browser enforces
 * `connect-src` against the redirect target, not merely the URL requested. The
 * hostnames vary by region, so allowlisting them would be fragile as well as
 * weaker.
 *
 * `allowRemoteModels = false` is the belt to that braces: if a future change
 * removes a local file, this fails loudly instead of quietly reaching out to a
 * third party and contradicting the claim on the page.
 */
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = "/models/";

/**
 * Point the ONNX runtime at binaries we serve ourselves.
 *
 * By default the library fetches a multi-megabyte runtime from a third-party
 * CDN at first inference. That would be a request the Content-Security-Policy
 * does not permit, so inference would fail outright rather than degrade, and
 * the `/wasm/*` cache headers would be dead configuration. Cross-origin
 * isolation is deliberately off, so the threaded build cannot use threads
 * anyway and one is the honest number.
 */
const wasmBackend = env.backends?.onnx?.wasm;
if (wasmBackend) {
  wasmBackend.wasmPaths = "/wasm/v1/";
  wasmBackend.numThreads = 1;
}

/**
 * Count this realm's requests, and wrap every mechanism rather than only
 * `fetch`.
 *
 * The status line claims a number of network requests, and the main thread
 * cannot see any of the ones that matter: a worker has its own global scope and
 * its own `fetch`, and every byte of the model arrives here. Patching only the
 * page would have displayed a confident zero beside a running download, which is
 * worse than showing nothing at all.
 *
 * `sendBeacon` and `WebSocket` are wrapped too. Neither is used, and that is the
 * point: if a dependency ever starts using one, the counter notices instead of
 * staying reassuringly at zero.
 */
let netCount = 0;
let netInflight = 0;

function reportNet() {
  post({ type: "net", count: netCount, inflight: netInflight });
}

const originalFetch = self.fetch.bind(self);
self.fetch = ((...args: Parameters<typeof fetch>) => {
  netCount++;
  netInflight++;
  reportNet();
  return originalFetch(...args).finally(() => {
    netInflight = Math.max(0, netInflight - 1);
    reportNet();
  });
}) as typeof fetch;

const scope = self as unknown as {
  sendBeacon?: (...args: unknown[]) => boolean;
  WebSocket?: unknown;
};
if (typeof scope.sendBeacon === "function") {
  const originalBeacon = scope.sendBeacon.bind(scope);
  scope.sendBeacon = (...args: unknown[]) => {
    netCount++;
    reportNet();
    return originalBeacon(...args);
  };
}

type Extractor = Awaited<ReturnType<typeof pipeline<"feature-extraction">>>;

type Loaded = { extractor: Extractor; device: DeviceKind };

let loading: Promise<Loaded> | null = null;
let current: Loaded | null = null;
/** One demotion per page load, then stay where we landed. */
let demoted = false;

function post(message: unknown) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

async function build(device: DeviceKind): Promise<Loaded> {
  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    device,
    dtype: MODEL_DTYPE,
    revision: MODEL_REVISION,
    progress_callback: (progress: unknown) => {
      post({ type: "progress", device, progress });
    },
  });
  return { extractor, device };
}

/**
 * Try WebGPU, fall back to WASM. The capability check alone is not enough:
 * pipeline construction can throw on a device that advertises support.
 */
async function load(): Promise<Loaded> {
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      return await build("webgpu");
    } catch (error) {
      post({ type: "notice", message: `webgpu unavailable at load: ${String(error)}` });
    }
  }
  return build("wasm");
}

function get(): Promise<Loaded> {
  if (!loading) {
    loading = load().then((loaded) => {
      current = loaded;
      post({ type: "ready", device: loaded.device });
      return loaded;
    });
  }
  return loading;
}

/**
 * WebGPU's real failure modes land AFTER `ready` has been posted: a lost device
 * on driver reset or integrated-GPU exhaustion, shader compilation errors on
 * first dispatch, and unimplemented-operator errors that only surface once a
 * shape actually runs. Without this path the status line keeps claiming WebGPU
 * while every scan silently rejects, and the user believes their draft is clean.
 */
async function demoteToWasm(): Promise<Loaded> {
  demoted = true;
  loading = null;
  current = null;
  const loaded = await build("wasm");
  current = loaded;
  loading = Promise.resolve(loaded);
  post({ type: "ready", device: "wasm", demoted: true });
  return loaded;
}

async function embed(texts: string[]): Promise<number[][]> {
  let { extractor, device } = await get();
  try {
    return await run(extractor, texts);
  } catch (error) {
    if (device === "webgpu" && !demoted) {
      post({ type: "notice", message: `webgpu failed during inference, demoting: ${String(error)}` });
      ({ extractor } = await demoteToWasm());
      return run(extractor, texts);
    }
    throw error;
  }
}

async function run(extractor: Extractor, texts: string[]): Promise<number[][]> {
  // One batched call. Per-text calls would multiply dispatch overhead, which
  // dominates at this model size.
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const { data, dims } = output as unknown as { data: Float32Array; dims: number[] };
  const width = dims[dims.length - 1];
  const rows: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    rows.push(Array.from(data.subarray(i * width, (i + 1) * width)));
  }
  return rows;
}

/**
 * Start loading as soon as the worker exists, rather than waiting for the first
 * request.
 *
 * This line is load-bearing. Without it the handshake deadlocks: `get()` is what
 * posts `ready`, and it used to be reachable only from `embed()`, while the page
 * only sends an `embed` once it has seen `ready`. Each side waited for the other
 * and the model was never fetched, so the status line sat at 0% forever with the
 * worker script loaded and no model request in flight.
 *
 * Eager loading is also the behaviour the tiered load design wants: the download
 * should begin while the visitor reads the seeded thread, not on their first
 * keystroke.
 */
void get().catch((error) => {
  post({ type: "fatal", message: String(error) });
});

self.addEventListener("message", async (event: MessageEvent) => {
  const { id, type, texts } = event.data ?? {};
  if (type !== "embed") return;
  try {
    const vectors = await embed(texts as string[]);
    post({ id, type: "result", vectors, device: current?.device });
  } catch (error) {
    // Never let a rejection escape unreported. The caller resolves the scan with
    // ranSemantic false rather than throwing, and the UI says so honestly
    // instead of implying a clean draft.
    post({ id, type: "error", message: String(error) });
  }
});
