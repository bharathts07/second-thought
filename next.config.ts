import type { NextConfig } from "next";

/**
 * Static export only. There is no server in this project: no API routes, no
 * route handlers, no server actions, no middleware. That is a product decision
 * rather than a deployment detail, because the privacy claim rests on there
 * being no endpoint that could receive what a visitor types.
 */
const nextConfig: NextConfig = {
  output: "export",

  // next/image optimisation needs a server. A static export has none.
  images: { unoptimized: true },

  /**
   * One random number, chosen here at build time, that picks the demo's two
   * participant names.
   *
   * It lives in the config rather than in the component because of a measured
   * hydration bug. The names were first chosen by calling `Math.random()` at module
   * scope in `Thread.tsx`, with a comment claiming that module scope "avoids
   * hydration mismatches entirely" because it runs before render. The opposite is
   * true: `Thread.tsx` is part of the client bundle, so its module scope runs a
   * second time in the browser and drew a different pair. The prerendered HTML said
   * Skylar and Casey, the browser said something else, and the page logged React
   * error #418, a hydration text mismatch, on every load.
   *
   * `env` is inlined by the bundler at build time into BOTH the prerender and the
   * client bundle, so both realms read the same literal and there is nothing left to
   * disagree about. The names still change on every build, which is what was wanted;
   * they just no longer change between the server's opinion and the browser's.
   *
   * The tempting alternative, randomising in a `useEffect` after mount, also works,
   * but it means the first paint shows one name and swaps it a frame later. On a page
   * whose entire pitch is that it is careful and finished, a visible flicker in the
   * conversation is a worse trade than fixing the names per deploy.
   */
  env: {
    NEXT_PUBLIC_NAME_SEED: String(Math.floor(Math.random() * 100_000)),
  },

  /**
   * Keep Node-only packages out of the browser bundle.
   *
   * `@huggingface/transformers` ships both a browser path (onnxruntime-web) and
   * a Node path (onnxruntime-node) and chooses by module resolution. In the
   * browser bundle the Node runtime must resolve to nothing, or the build fails.
   *
   * The alias is deliberately NOT applied on the server. The evaluation
   * pipeline runs the same model through onnxruntime-node to prove the vectors
   * it publishes match what a browser actually computes; aliasing it away
   * globally would break that, silently and confusingly.
   *
   * Both bundlers are configured because Next 16 defaults to Turbopack and
   * ignores the `webpack` key entirely. Whichever bundler runs, the alias
   * applies. T1.1.5 verifies that empirically instead of assuming it.
   */
  turbopack: {
    resolveAlias: {
      sharp: { browser: "./stubs/empty.ts" },
      "onnxruntime-node": { browser: "./stubs/empty.ts" },
    },
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = { ...config.resolve.alias, sharp$: false };
    if (!isServer) {
      config.resolve.alias["onnxruntime-node$"] = false;
    }
    return config;
  },
};

export default nextConfig;
