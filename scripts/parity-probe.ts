import { env, pipeline } from "@huggingface/transformers";
const S = "we guarantee your data never leaves the US";
function cos(a: Float32Array, b: Float32Array) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; }
(async () => {
  env.allowLocalModels = false;
  const out: Record<string, Float32Array> = {};
  for (const dtype of ["q8", "fp32"] as const) {
    const p = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { device: "cpu", dtype: dtype as never });
    const r = await p([S], { pooling: "mean", normalize: true });
    out[dtype] = (r as unknown as { data: Float32Array }).data.slice(0, 384);
  }
  console.log(`  cosine(q8, fp32) = ${cos(out.q8, out.fp32).toFixed(6)}`);
  let max = 0; for (let i = 0; i < 384; i++) max = Math.max(max, Math.abs(out.q8[i] - out.fp32[i]));
  console.log(`  max component delta = ${max.toFixed(6)}`);
})();
