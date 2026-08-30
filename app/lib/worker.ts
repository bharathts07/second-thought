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

/** Fetch from the Hub rather than looking for a local copy. */
env.allowLocalModels = false;

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
  wasmBackend.wasmPaths = "/wasm/";
  wasmBackend.numThreads = 1;
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
