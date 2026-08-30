/**
 * Model identity, in one place.
 *
 * Imported by the worker, the exemplar-vector cache, and later the evaluation
 * pipeline. The revision is pinned rather than tracking `main`: the personal
 * rule cache is keyed on it, so an upstream re-export of the ONNX artifacts
 * would otherwise leave stale vectors that are not merely old but meaningless,
 * and the symptom would be a rule that silently stops matching anything.
 *
 * The device is part of the cache key too. Vectors computed on WebGPU and later
 * compared against WASM-computed vectors differ by enough to cross a hand-tuned
 * threshold, and a revision-only key would call that cache valid.
 */

export const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/**
 * Pin this to a concrete commit SHA before the first deploy. `main` is a moving
 * target and this constant is load-bearing for cache validity.
 */
export const MODEL_REVISION = "main";

export const EMBEDDING_DIMS = 384;

/**
 * `q8` is the WASM fast path. onnxruntime-web's WebGPU backend has no int8
 * matmul kernels, so q8-on-WebGPU either round-trips per operation and runs
 * slower than plain WASM, or throws outright. Which dtype and device pairing
 * actually wins is a measurement, not an assumption: T1.5.2 records wasm+q8,
 * webgpu+q8, and webgpu+q4f16 on one machine and the winner becomes the coded
 * default per device.
 */
export const MODEL_DTYPE = "q8" as const;

/** Cache key for stored exemplar vectors. Both parts matter; see above. */
export function vectorCacheKey(device: string): string {
  return `${MODEL_ID}@${MODEL_REVISION}/${MODEL_DTYPE}/${device}`;
}
