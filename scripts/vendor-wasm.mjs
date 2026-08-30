/**
 * Copy the ONNX runtime files we actually use into `public/wasm/`.
 *
 * Two reasons this is not optional. The library otherwise fetches the runtime
 * from a third-party CDN at first inference, which the Content-Security-Policy
 * does not permit, so inference would fail outright rather than degrade. And
 * `_headers` declares cache rules for `/wasm/*`, which would be dead
 * configuration pointing at files that were never served.
 *
 * Only the plain WASM runtime is copied. The WebGPU-capable variant is 24.9 MiB
 * against Cloudflare Pages' 25 MiB per-file cap, and measurement showed q8 on
 * the plain runtime is both fastest and the only artifact that fits, so the
 * larger file buys nothing and risks a deploy rejected at upload.
 */
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const SRC = "node_modules/onnxruntime-web/dist";
const DEST = "public/wasm";

// The runtime binary plus its JS glue. Names are version-coupled, so a bump
// that renames them should fail loudly here rather than at first inference.
const WANTED = [
  "ort-wasm-simd-threaded.wasm",
  "ort-wasm-simd-threaded.mjs",
];

const available = await readdir(SRC);
await mkdir(DEST, { recursive: true });

let total = 0;
for (const name of WANTED) {
  if (!available.includes(name)) {
    console.error(`vendor-wasm: ${name} is missing from ${SRC}.`);
    console.error("The runtime package renamed its artifacts. Update WANTED rather than");
    console.error("falling back to the CDN, which the CSP blocks.");
    process.exit(1);
  }
  await copyFile(join(SRC, name), join(DEST, name));
  const { size } = await stat(join(DEST, name));
  total += size;
  console.log(`vendor-wasm: ${name} ${(size / 1048576).toFixed(1)} MiB`);
}

const CAP = 25 * 1024 * 1024;
for (const name of WANTED) {
  const { size } = await stat(join(DEST, name));
  if (size >= CAP) {
    console.error(`vendor-wasm: ${name} is ${(size / 1048576).toFixed(1)} MiB, at or over the 25 MiB`);
    console.error("Cloudflare Pages per-file cap. The deploy would be rejected at upload.");
    process.exit(1);
  }
}
console.log(`vendor-wasm: ${(total / 1048576).toFixed(1)} MiB total, under the per-file cap`);
