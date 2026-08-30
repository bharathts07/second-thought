/**
 * T1.5.2. Measures dtype and device pairings so the coded default is a
 * measurement rather than an assumption, and so F35's wasm vendoring narrows to
 * the variant we actually use.
 *
 * Node only, and deliberately so: it isolates the model question from the
 * bundler question. Node has no WebGPU, so it measures the dtype axis. The
 * device axis is measured in the browser at T1.5.
 */
import { env, pipeline } from "@huggingface/transformers";

const SENTENCES = [
  "Yes, we guarantee your data never leaves the US.",
  "Our data-residency options depend on your deployment and contract terms.",
  "I will send the SOC 2 report over tomorrow along with the DPA.",
];

const DTYPES = ["q8", "q4", "fp32"] as const;

async function measure(dtype: string) {
  const t0 = performance.now();
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    device: "cpu",
    dtype: dtype as never,
  });
  const load = performance.now() - t0;

  // Warm once, then time.
  await extractor(SENTENCES, { pooling: "mean", normalize: true });
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await extractor(SENTENCES, { pooling: "mean", normalize: true });
    runs.push(performance.now() - t);
  }
  runs.sort((a, b) => a - b);
  const out = await extractor(SENTENCES, { pooling: "mean", normalize: true });
  const dims = (out as unknown as { dims: number[] }).dims;
  return { dtype, loadMs: Math.round(load), warmMs: Math.round(runs[2]), dims: dims[dims.length - 1] };
}

(async () => {
  env.allowLocalModels = false;
  console.log("dtype   load(ms)  warm 3-sentence(ms)  dims");
  for (const d of DTYPES) {
    try {
      const r = await measure(d);
      console.log(`${r.dtype.padEnd(7)} ${String(r.loadMs).padStart(8)}  ${String(r.warmMs).padStart(19)}  ${r.dims}`);
    } catch (e) {
      console.log(`${d.padEnd(7)} FAILED: ${String(e).slice(0, 90)}`);
    }
  }
})();
