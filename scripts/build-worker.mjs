/**
 * Bundle the encoder worker into `public/worker.js` ourselves.
 *
 * Turbopack does not compile `new Worker(new URL("./worker.ts", import.meta.url))`
 * into a worker entry. It treats the reference as a static asset and copies the
 * TypeScript file verbatim into `_next/static/media/`, where it is served as
 * `video/mp2t`, because that is what a `.ts` extension means to a web server.
 * The browser then refuses to execute it as a module and the Worker constructor
 * fails, which surfaces as a checker that never finishes loading rather than as
 * an error anyone would recognise.
 *
 * Bundling it here removes the bundler from the question entirely: one plain
 * same-origin ESM file, deterministic, and CSP-friendly under `worker-src 'self'`.
 */
import { build } from "esbuild";
import { stat } from "node:fs/promises";

const OUT = "public/worker.js";

await build({
  entryPoints: ["app/lib/worker.ts"],
  outfile: OUT,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  // The ONNX runtime binaries are fetched at runtime from /wasm/, not inlined.
  external: ["*.wasm"],
  legalComments: "none",
  logLevel: "warning",
});

const { size } = await stat(OUT);
console.log(`build-worker: ${OUT} ${(size / 1048576).toFixed(2)} MiB`);
if (size >= 25 * 1024 * 1024) {
  console.error("build-worker: over the 25 MiB Cloudflare Pages per-file cap.");
  process.exit(1);
}
