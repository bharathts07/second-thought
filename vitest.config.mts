import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The engine is pure functions over data, so `node` is the right environment:
 * no jsdom, no browser globals, and tests that run in milliseconds.
 *
 * The `@` alias exists because tsconfig declares it and TypeScript therefore
 * accepts it, but Vite would not resolve it at runtime. Type-only imports
 * survive either way since they are erased before Vite sees them, which makes
 * the failure asymmetric and confusing: `import type { Finding } from "@/..."`
 * passes while `import { COMPANY_RULES } from "@/..."` throws
 * "Cannot find package". Three modules hit that independently during the build.
 *
 * Convention regardless: inside `app/lib`, import siblings relatively. The
 * alias is for reaching lib from components, where relative paths get ugly.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
