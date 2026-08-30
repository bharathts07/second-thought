/**
 * Download the encoder into `public/models/` so the site serves it itself.
 *
 * The plan intended to start on the Hugging Face CDN and move to our own origin
 * later. The Content-Security-Policy forced the issue immediately, and measuring
 * why was worth more than the delay: `connect-src 'self' https://huggingface.co`
 * did NOT permit the download, because the Hub redirects to a regional CDN host
 * (`us.aws.cdn.hf.co`) and Chrome enforces the directive against the REDIRECT
 * TARGET, not only the URL you asked for. A research note in this project claimed
 * the opposite as settled fact. It is measurably wrong.
 *
 * Chasing those hostnames into the allowlist would be fragile: they vary by
 * region and change without notice. Serving the weights ourselves removes the
 * whole class of problem, and the q8 artifact is 21.9 MiB against Cloudflare
 * Pages' 25 MiB per-file cap, so it fits with real headroom.
 *
 * It also makes the strongest form of the privacy claim true NOW rather than
 * later: with no third-party origin involved, `connect-src` narrows to `'self'`.
 */
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const REPO = "Xenova/all-MiniLM-L6-v2";
const REVISION = "main";
const DEST = join("public/models", REPO);

// What transformers.js needs for a local feature-extraction pipeline.
const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
];

const CAP = 25 * 1024 * 1024;

for (const file of FILES) {
  const url = `https://huggingface.co/${REPO}/resolve/${REVISION}/${file}`;
  const target = join(DEST, file);
  try {
    const { size } = await stat(target);
    if (size > 0) {
      console.log(`vendor-model: ${file} present (${(size / 1048576).toFixed(1)} MiB)`);
      continue;
    }
  } catch {
    // Not downloaded yet.
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.error(`vendor-model: ${file} -> HTTP ${res.status}`);
    process.exit(1);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  if (bytes.byteLength >= CAP) {
    console.error(`vendor-model: ${file} is ${(bytes.byteLength / 1048576).toFixed(1)} MiB,`);
    console.error("at or over the 25 MiB Cloudflare Pages per-file cap. The upload would be rejected.");
    process.exit(1);
  }
  console.log(`vendor-model: ${file} ${(bytes.byteLength / 1048576).toFixed(1)} MiB`);
}
