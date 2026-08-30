/**
 * The request counter, which is the only number on the product surface that the
 * privacy claim depends on.
 *
 * `useEngine` had no tests at all, and that is precisely how it came to render `7`
 * directly above the sentence "since then this page has made no requests". The hook
 * itself still has none here: it owns a worker, a patched `window.fetch` and four
 * pieces of React state, and standing all of that up without a renderer would test
 * the mock rather than the code. So the arithmetic that was actually wrong was pulled
 * out into a pure function, and that is what is pinned below.
 *
 * What this does NOT cover: that the hook snapshots the baseline in the `ready`
 * branch and mirrors both counters into refs. That wiring is a handful of lines,
 * visible in the source, and an integration test for it needs a worker harness that
 * does not exist yet.
 */

import { describe, expect, it } from "vitest";
import { requestsSinceReady } from "./useEngine";

const ready = { ready: true, inflight: 0 };

describe("requestsSinceReady", () => {
  /**
   * The regression. The checker's own download used to be counted as traffic that
   * happened after the checker had finished downloading.
   */
  it("excludes the requests that fetched the checker", () => {
    // Seven requests brought the model down, then `ready` arrived.
    expect(requestsSinceReady({ ...ready, total: 7, baseline: 7 })).toBe(0);
  });

  it("counts what happens after ready, and only that", () => {
    expect(requestsSinceReady({ ...ready, total: 9, baseline: 7 })).toBe(2);
  });

  it("stays at zero across a long boot, however many requests it took", () => {
    for (const n of [1, 7, 23, 480]) {
      expect(requestsSinceReady({ ...ready, total: n, baseline: n }), `${n}`).toBe(0);
    }
  });

  /**
   * `null` is a distinct outcome from `0` and the caller renders nothing for it. A
   * confident `0` beside a running download would discredit the whole claim, which is
   * the failure `PRODUCT.md` principle 6 names.
   */
  it("returns null while still booting, rather than a reassuring zero", () => {
    expect(requestsSinceReady({ total: 4, baseline: null, ready: false, inflight: 0 })).toBeNull();
  });

  it("returns null once ready if a baseline was somehow never captured", () => {
    expect(requestsSinceReady({ ...ready, total: 4, baseline: null })).toBeNull();
  });

  it("returns null while anything is in flight, because the number is already stale", () => {
    expect(requestsSinceReady({ total: 9, baseline: 7, ready: true, inflight: 1 })).toBeNull();
  });

  /**
   * Reachable by ordinary React batching: the baseline is read from refs, which hold
   * the newest count, while the total comes from rendered state one render behind. A
   * negative count would be a worse lie than a momentary zero.
   */
  it("never reports a negative count when state trails the baseline", () => {
    expect(requestsSinceReady({ ...ready, total: 6, baseline: 7 })).toBe(0);
  });
});
