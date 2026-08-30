/**
 * Tests for the testing seam.
 *
 * The seam is load-bearing for every other test in the engine, so it gets its own
 * suite: if `vectorAt` were off by a thousandth, a threshold test would pass or
 * fail for reasons that have nothing to do with the threshold, and the engine's
 * calibration numbers would be quietly wrong.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { EMBEDDING_DIMS } from "./model";
import {
  cosine,
  fakeEmbedder,
  pseudoVector,
  unitVector,
  vectorAt,
} from "./test-embedder";
import type { Embed } from "./types";

function length(v: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/** The sweep range T2.7.2 actually uses, plus the degenerate ends. */
const SWEEP = [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95];

describe("unitVector", () => {
  it("is unit length in every dimension count", () => {
    for (const dims of [2, 3, 8, 17, 384]) {
      expect(length(unitVector(dims, 1))).toBeCloseTo(1, 6);
    }
    expect(unitVector(EMBEDDING_DIMS, "seed").length).toBe(EMBEDDING_DIMS);
  });

  it("is deterministic for the same seed and different across seeds", () => {
    expect(Array.from(unitVector(8, 42))).toEqual(Array.from(unitVector(8, 42)));
    expect(Array.from(unitVector(8, "abc"))).toEqual(Array.from(unitVector(8, "abc")));
    expect(Array.from(unitVector(8, 42))).not.toEqual(Array.from(unitVector(8, 43)));
  });

  it("puts unrelated seeds near-orthogonal, so a pseudo-vector cannot clear a threshold", () => {
    // Uniform directions in 384 dimensions have cosine standard deviation near
    // 0.051, so nothing here should come close to the 0.45 floor of the sweep.
    for (let a = 0; a < 6; a++) {
      for (let b = a + 1; b < 6; b++) {
        const score = Math.abs(cosine(unitVector(EMBEDDING_DIMS, a), unitVector(EMBEDDING_DIMS, b)));
        expect(score).toBeLessThan(0.25);
      }
    }
  });

  it("rejects a dimension count that cannot hold a vector", () => {
    expect(() => unitVector(0, 1)).toThrow(/positive integer/);
    expect(() => unitVector(1.5, 1)).toThrow(/positive integer/);
  });
});

describe("cosine", () => {
  it("is 1 against itself and unchanged by scaling either side", () => {
    const v = unitVector(384, "self");
    expect(cosine(v, v)).toBeCloseTo(1, 9);

    const scaled = new Float32Array(v.length);
    for (let i = 0; i < v.length; i++) scaled[i] = v[i] * 7.5;
    expect(cosine(v, scaled)).toBeCloseTo(1, 6);
  });

  it("refuses inputs it cannot compare", () => {
    expect(() => cosine(unitVector(4, 1), unitVector(5, 1))).toThrow(/length mismatch/);
    expect(() => cosine(unitVector(4, 1), new Float32Array(4))).toThrow(/no direction/);
  });
});

describe("vectorAt", () => {
  it("hits the requested cosine to within 1e-6 across the sweep range", () => {
    const base = unitVector(EMBEDDING_DIMS, "residency-exemplar");
    for (const target of SWEEP) {
      expect(cosine(vectorAt(base, target), base)).toBeCloseTo(target, 6);
    }
  });

  it("hits the requested cosine at the ends and below zero", () => {
    const base = unitVector(EMBEDDING_DIMS, "base");
    for (const target of [-1, -0.5, 0, 1]) {
      expect(cosine(vectorAt(base, target), base)).toBeCloseTo(target, 6);
    }
  });

  it("holds that accuracy in small dimension counts and with an unnormalised base", () => {
    for (const dims of [2, 3, 8, 17]) {
      const base = unitVector(dims, dims);
      expect(cosine(vectorAt(base, 0.7), base)).toBeCloseTo(0.7, 6);
    }
    const long = unitVector(384, "long");
    const scaled = new Float32Array(long.length);
    for (let i = 0; i < long.length; i++) scaled[i] = long[i] * 12;
    expect(cosine(vectorAt(scaled, 0.62), scaled)).toBeCloseTo(0.62, 6);
  });

  it("returns unit-length vectors, so the matcher's dot-product shortcut stays valid", () => {
    const base = unitVector(EMBEDDING_DIMS, "unit");
    for (const target of [...SWEEP, -1, 0, 1]) {
      expect(length(vectorAt(base, target))).toBeCloseTo(1, 6);
    }
  });

  it("straddles a threshold, which is the reason this utility exists", () => {
    const threshold = 0.7;
    const base = unitVector(EMBEDDING_DIMS, "exemplar");
    const above = cosine(vectorAt(base, threshold + 0.001), base);
    const below = cosine(vectorAt(base, threshold - 0.001), base);
    expect(above).toBeGreaterThan(threshold);
    expect(below).toBeLessThan(threshold);
    expect(above - below).toBeCloseTo(0.002, 6);
  });

  it("gives distinct vectors at one cosine, for same-score different-text cases", () => {
    const base = unitVector(EMBEDDING_DIMS, "shared");
    const a = vectorAt(base, 0.8, "clause-a");
    const b = vectorAt(base, 0.8, "clause-b");
    expect(Array.from(a)).not.toEqual(Array.from(b));
    expect(cosine(a, base)).toBeCloseTo(0.8, 6);
    expect(cosine(b, base)).toBeCloseTo(0.8, 6);
    expect(Array.from(vectorAt(base, 0.8, "clause-a"))).toEqual(Array.from(a));
  });

  it("names the test bug rather than returning something plausible", () => {
    const base = unitVector(8, 1);
    expect(() => vectorAt(base, 1.2)).toThrow(/within \[-1, 1\]/);
    expect(() => vectorAt(base, Number.NaN)).toThrow(/within \[-1, 1\]/);
    expect(() => vectorAt(new Float32Array(8), 0.5)).toThrow(/no direction/);
    expect(() => vectorAt(unitVector(1, 1), 0.5)).toThrow(/holds no vector at cosine/);
    // A 1-dimensional space still has the two parallel answers.
    expect(cosine(vectorAt(unitVector(1, 1), -1), unitVector(1, 1))).toBeCloseTo(-1, 6);
  });
});

describe("fakeEmbedder vectors", () => {
  it("returns the hand-written vector for a known string, from a Map or an object", () => {
    const promise = unitVector(EMBEDDING_DIMS, "promise");
    const fromMap = fakeEmbedder({ vectors: new Map([["we guarantee this", promise]]) });
    const fromObject = fakeEmbedder({ vectors: { "we guarantee this": promise } });

    expect(fromMap.vectorFor("we guarantee this")).toBe(promise);
    expect(fromObject.vectorFor("we guarantee this")).toBe(promise);
  });

  it("resolves in argument order, one vector per text", async () => {
    const known = unitVector(EMBEDDING_DIMS, "known");
    const fake = fakeEmbedder({ vectors: { known } });
    const out = await fake(["unknown", "known"]);

    expect(out).toHaveLength(2);
    expect(out[1]).toBe(known);
    expect(cosine(out[0], pseudoVector("unknown"))).toBeCloseTo(1, 6);
  });

  it("gives an unknown string a stable pseudo-vector across calls and instances", async () => {
    const first = await fakeEmbedder()(["never seen before"]);
    const second = await fakeEmbedder()(["never seen before"]);
    expect(Array.from(first[0])).toEqual(Array.from(second[0]));
    expect(length(first[0])).toBeCloseTo(1, 6);
    expect(first[0].length).toBe(EMBEDDING_DIMS);
  });

  it("honours a custom dimension count for generated vectors", async () => {
    const out = await fakeEmbedder({ dims: 16 })(["short"]);
    expect(out[0].length).toBe(16);
  });
});

describe("fakeEmbedder call counting", () => {
  it("starts at zero, which is what makes an internal recipient assertable", () => {
    const fake = fakeEmbedder();
    expect(fake.calls).toBe(0);
    expect(fake.callTexts).toEqual([]);
    expect(fake.pending).toEqual([]);
  });

  it("counts calls and records their arguments in order", async () => {
    const fake = fakeEmbedder();
    await fake(["a", "b"]);
    await fake(["c"]);

    expect(fake.calls).toBe(2);
    expect(fake.callTexts).toEqual([["a", "b"], ["c"]]);
  });

  it("snapshots the argument array, so a reused buffer cannot rewrite history", async () => {
    const fake = fakeEmbedder();
    const texts = ["first"];
    await fake(texts);
    texts[0] = "mutated";

    expect(fake.callTexts[0]).toEqual(["first"]);
  });

  it("counts a rejected call, since a failed embed still happened", async () => {
    const fake = fakeEmbedder({ rejectWith: new Error("no model") });
    await expect(fake(["x"])).rejects.toThrow("no model");
    expect(fake.calls).toBe(1);
  });

  it("resolves whenCalled once the calls arrive, before and after the fact", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    let reached = false;
    const waited = fake.whenCalled(2).then(() => {
      reached = true;
    });

    void fake(["one"]);
    await Promise.resolve();
    expect(reached).toBe(false);

    void fake(["two"]);
    await waited;
    expect(reached).toBe(true);
    await fake.whenCalled(1);
  });
});

describe("fakeEmbedder resolve order", () => {
  it("holds every call open in manual mode", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    let settled = false;
    void fake(["held"]).then(() => {
      settled = true;
    });

    await new Promise((r) => setTimeout(r, 0));
    expect(settled).toBe(false);
    expect(fake.pending).toEqual([{ index: 0, texts: ["held"] }]);

    await fake.settle(0);
    expect(settled).toBe(true);
    expect(fake.pending).toEqual([]);
  });

  it("settles two in-flight calls out of order, newest first", async () => {
    // This is the mechanism T2.6.6's supersede guard is tested with: scan 1 and
    // scan 2 are both open, and scan 2 comes back first.
    const fake = fakeEmbedder({ resolve: "manual" });
    const order: string[] = [];
    const first = fake(["scan one"]).then(() => order.push("first"));
    const second = fake(["scan two"]).then(() => order.push("second"));

    expect(fake.pending.map((c) => c.index)).toEqual([0, 1]);

    await fake.settleInOrder(1, 0);
    await Promise.all([first, second]);

    expect(order).toEqual(["second", "first"]);
  });

  it("settles three calls in an arbitrary requested order", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    const order: number[] = [];
    const all = [0, 1, 2].map((i) => fake([`call ${i}`]).then(() => order.push(i)));

    await fake.settleInOrder(2, 0, 1);
    await Promise.all(all);

    expect(order).toEqual([2, 0, 1]);
  });

  it("leaves the unsettled calls pending while one is settled", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    void fake(["a"]);
    void fake(["b"]);

    await fake.settle(1);
    expect(fake.pending.map((c) => c.index)).toEqual([0]);
    expect(fake.calls).toBe(2);
  });

  it("refuses to settle a call twice or a call that was never made", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    void fake(["a"]);
    await fake.settle(0);

    await expect(fake.settle(0)).rejects.toThrow(/already settled/);
    await expect(fake.settle(7)).rejects.toThrow(/no call 7/);
  });
});

describe("fakeEmbedder rejection", () => {
  it("propagates the injected error, preserving identity", async () => {
    const boom = new Error("worker died mid-inference");
    const fake = fakeEmbedder({ rejectWith: boom });
    await expect(fake(["anything"])).rejects.toBe(boom);
  });

  it("propagates a non-Error rejection, which a worker can genuinely produce", async () => {
    const fake = fakeEmbedder({ rejectWith: "ort backend unavailable" });
    await expect(fake(["anything"])).rejects.toBe("ort backend unavailable");
  });

  it("rejects only the calls rejectOn selects", async () => {
    const fake = fakeEmbedder({
      rejectOn: (_texts, callIndex) => (callIndex === 1 ? new Error("second call") : undefined),
    });

    await expect(fake(["a"])).resolves.toHaveLength(1);
    await expect(fake(["b"])).rejects.toThrow("second call");
    await expect(fake(["c"])).resolves.toHaveLength(1);
  });

  it("can select by content, so one draft fails and another does not", async () => {
    const fake = fakeEmbedder({
      rejectOn: (texts) => (texts.some((t) => t.includes("boom")) ? new Error("hit") : undefined),
    });

    await expect(fake(["safe"])).resolves.toHaveLength(1);
    await expect(fake(["boom"])).rejects.toThrow("hit");
  });

  it("rejects a held call at the moment the test chooses", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    const outcome = fake(["held"]).then(
      () => "resolved",
      (error: unknown) => (error as Error).message,
    );

    await fake.fail(0, new Error("injected mid-flight"));
    expect(await outcome).toBe("injected mid-flight");
  });

  it("supplies its own error when fail is called bare", async () => {
    const fake = fakeEmbedder({ resolve: "manual" });
    const outcome = fake(["held"]).then(
      () => null,
      (error: unknown) => error,
    );

    await fake.fail(0);
    expect(await outcome).toBeInstanceOf(Error);
  });

  it("keeps a predetermined rejection when the test settles it in manual mode", async () => {
    // Outcome is fixed at call time and timing is fixed at settle time, so an
    // out-of-order test works the same whether a call succeeds or fails.
    const fake = fakeEmbedder({ resolve: "manual", rejectWith: new Error("always") });
    const outcome = fake(["held"]).then(
      () => "resolved",
      (error: unknown) => (error as Error).message,
    );

    await fake.settle(0);
    expect(await outcome).toBe("always");
  });

  it("is still a plain Embed, so a scanner takes it unchanged", async () => {
    const embed: Embed = fakeEmbedder();
    await expect(embed(["a", "b", "c"])).resolves.toHaveLength(3);
  });
});

describe("fakeEmbedder under fake timers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * The scanner's debounce is 300ms, 600ms on WASM, so its tests run on a fake
   * clock. If settling needed a real timer, every out-of-order test would hang
   * and the failure would look like a scanner deadlock.
   */
  it("settles without a real timer, so a debounce test can use a fake clock", async () => {
    vi.useFakeTimers();
    const fake = fakeEmbedder({ resolve: "manual" });
    const order: number[] = [];
    const all = [0, 1].map((i) => fake([`call ${i}`]).then(() => order.push(i)));

    await fake.settleInOrder(1, 0);
    await Promise.all(all);

    expect(order).toEqual([1, 0]);
  }, 2000);

  it("fails a held call without a real timer either", async () => {
    vi.useFakeTimers();
    const fake = fakeEmbedder({ resolve: "manual" });
    const outcome = fake(["held"]).then(
      () => "resolved",
      () => "rejected",
    );

    await fake.fail(0);
    expect(await outcome).toBe("rejected");
  }, 2000);
});

describe("harness footguns that would silently mislead a test", () => {
  it("refuses a numeric seed that would truncate onto another seed", () => {
    // 1.7 | 0 is 1 and NaN | 0 is 0, so both used to return an existing seed's
    // vector, and "these two vectors differ" would pass with one vector.
    expect(() => unitVector(4, 1.7)).toThrow(/safe integer/);
    expect(() => unitVector(4, Number.NaN)).toThrow(/safe integer/);
    expect(() => vectorAt(unitVector(4, 1), 0.5, 2.5)).toThrow(/safe integer/);
  });

  it("keeps generated vectors the same width as hand-written fixtures", async () => {
    const fake = fakeEmbedder({ vectors: { known: unitVector(8, 1) } });
    const out = await fake(["known", "unknown"]);

    expect(out.map((v) => v.length)).toEqual([8, 8]);
    // Mixed widths would surface inside the matcher as a length error, so the
    // fixture set has to agree with itself.
    expect(() =>
      fakeEmbedder({ vectors: { a: unitVector(8, 1), b: unitVector(16, 1) } }),
    ).toThrow(/expected 8/);
    expect(() => fakeEmbedder({ dims: 384, vectors: { a: unitVector(8, 1) } })).toThrow(
      /has 8 dims/,
    );
  });

  it("keeps realistic unknown strings far below the sweep floor", () => {
    // The whole no-false-finding claim rests on this: an unknown sentence must
    // not drift over a 0.45 threshold against another unknown sentence.
    const texts = [
      "we guarantee your data never leaves the US",
      "can you confirm our data stays inside the US",
      "I'll ship the migration by Friday",
      "let's move this thread to my personal phone",
      "the internal roadmap slide is attached",
      "this vendor is a total dumpster fire",
      "nous pouvons vous aider avec la migration",
      "our SOC 2 Type II report is complete",
    ];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        expect(Math.abs(cosine(pseudoVector(texts[i]), pseudoVector(texts[j])))).toBeLessThan(0.3);
      }
    }
  });
});
