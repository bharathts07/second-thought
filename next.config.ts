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
