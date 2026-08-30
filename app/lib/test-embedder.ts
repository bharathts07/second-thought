/**
 * The testing seam (T2.6.9).
 *
 * Every rule in the engine is semantic, so with `skipSemantic: true` there is
 * nothing to de-duplicate and nothing to threshold: the dedupe precedence branch
 * (T2.6.3), the supersede guard (T2.6.6), the no-throw guarantee (T2.6.8), and the
 * cue/negator conjunction (T2.5.3) are all unreachable without an embedder that
 * runs in Node. Review finding F28 is exactly that gap. This module closes it with
 * hand-written vectors, so the whole engine is verifiable with no 23MB download
 * and no worker.
 *
 * Two properties matter more than convenience here.
 *
 * **Nothing is random.** A flaky detection test is worse than no detection test,
 * because a threshold that passes four runs in five reads as "calibrated". Every
 * vector below comes from a seeded generator, so a failure reproduces.
 *
 * **Cosines are constructed, not discovered.** `vectorAt` builds a vector at an
 * exact similarity to a base, which is what lets a test pin threshold behaviour at
 * 0.001 either side of a boundary. Sampling vectors and hoping one lands near the
 * threshold would tie every assertion to real model output, and the measured
 * scores in `review-findings.md` show that output is the thing under test.
 */

import { EMBEDDING_DIMS } from "./model";
import type { Embed } from "./types";

/**
 * FNV-1a over UTF-16 code units. Any stable hash would do; the point is that the
 * seed for an unknown string is derived from its characters and therefore carries
 * no semantic information at all. A test must never be able to pass because the
 * fake accidentally agreed with the real model.
 */
function hashSeed(seed: number | string): number {
  if (typeof seed === "number") {
    // `seed | 0` truncates, so 1.7 and NaN would silently alias to 1 and 0. Two
    // "different" seeds returning one vector makes a distinctness assertion pass
    // for the wrong reason, so name it instead.
    if (!Number.isSafeInteger(seed)) {
      throw new Error(`seed must be a safe integer or a string, got ${seed}`);
    }
    // Mix even for numeric seeds: consecutive integers passed straight into a
    // 32-bit PRNG produce visibly correlated first outputs.
    return (Math.imul(seed | 0, 0x01000193) ^ 0x811c9dc5) >>> 0;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32. Small, fast, and good enough that 384 draws look uncorrelated. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Gaussian rather than uniform components, because the distribution decides how
 * two unrelated vectors relate. Gaussian draws give a direction uniform on the
 * sphere, so two different seeds in 384 dimensions land near-orthogonal (|cos| of
 * roughly 0.05). That is what keeps an unknown string from drifting over a rule
 * threshold in the 0.45 to 0.95 sweep range and inventing a finding.
 */
function gaussians(dims: number, seed: number): Float64Array {
  const next = prng(seed);
  const out = new Float64Array(dims);
  for (let i = 0; i < dims; i += 2) {
    // Draw off zero: Math.log(0) is -Infinity and would poison the vector.
    const u = 1 - next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < dims) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return out;
}

function norm(v: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

function unit64(dims: number, seed: number): Float64Array {
  for (let attempt = 0; attempt < 8; attempt++) {
    const v = gaussians(dims, (seed + attempt * 0x9e3779b9) >>> 0);
    const n = norm(v);
    if (n > 1e-8) {
      for (let i = 0; i < dims; i++) v[i] /= n;
      return v;
    }
  }
  throw new Error("unitVector: generator produced only degenerate vectors");
}

/**
 * A deterministic unit vector. Same `dims` and `seed` always give the same
 * vector, on any machine, for the life of this file.
 */
export function unitVector(dims: number, seed: number | string): Float32Array {
  if (!Number.isInteger(dims) || dims < 1) {
    throw new Error(`unitVector: dims must be a positive integer, got ${dims}`);
  }
  return new Float32Array(unit64(dims, hashSeed(seed)));
}

/**
 * The vector the fake embedder returns for a string it was not given. Exported so
 * a test can build an exemplar map for rules it wants present but silent.
 */
export function pseudoVector(text: string, dims: number = EMBEDDING_DIMS): Float32Array {
  return unitVector(dims, `pseudo:${text}`);
}

/**
 * Cosine similarity, dividing by both norms rather than assuming unit length.
 *
 * T2.5.2 lets the matcher treat cosine as a bare dot product because production
 * vectors arrive normalised. An assertion helper must not inherit that assumption:
 * if a code path ever denormalises a vector, a dot-product-only helper reports it
 * as a similarity change and the test blames the threshold instead of the bug.
 */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(`cosine: length mismatch, ${a.length} vs ${b.length}`);
  }
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) {
    throw new Error("cosine: zero-length vector has no direction");
  }
  // Float rounding can put the quotient a hair outside [-1, 1], and a caller
  // taking an acos of that gets NaN.
  return Math.min(1, Math.max(-1, dot(a, b) / (na * nb)));
}

/**
 * A unit vector at an EXACT cosine to `base`.
 *
 * This is the utility the threshold tests are built on. Decompose the answer into
 * the base direction and one direction orthogonal to it:
 *
 *     v = t * b̂ + sqrt(1 - t²) * ô
 *
 * Both terms are unit and orthogonal, so |v| = 1 and cos(v, b̂) = t by
 * construction. `seed` picks which orthogonal direction, so a test can generate
 * several distinct segments that all sit at one similarity, which is what T2.6.3's
 * dedupe precedence and T2.5.3's cue gate need: the same score, different text.
 *
 * Accurate to roughly 1e-8 after the Float32Array round trip, comfortably inside
 * the 1e-6 the tests assert.
 */
export function vectorAt(
  base: Float32Array,
  targetCosine: number,
  seed: number | string = 0,
): Float32Array {
  if (!Number.isFinite(targetCosine) || targetCosine < -1 || targetCosine > 1) {
    throw new Error(`vectorAt: cosine must be within [-1, 1], got ${targetCosine}`);
  }
  const dims = base.length;
  const nb = norm(base);
  if (nb === 0) throw new Error("vectorAt: base has no direction");

  const b = new Float64Array(dims);
  for (let i = 0; i < dims; i++) b[i] = base[i] / nb;

  const s = Math.sqrt(Math.max(0, 1 - targetCosine * targetCosine));
  if (s === 0) {
    // Parallel or antiparallel: there is no orthogonal component to add, and
    // asking for one in a 1-dimensional space is a test bug worth naming.
    const out = new Float32Array(dims);
    for (let i = 0; i < dims; i++) out[i] = targetCosine * b[i];
    return out;
  }
  if (dims < 2) {
    throw new Error(
      `vectorAt: a ${dims}-dimensional space holds no vector at cosine ${targetCosine}`,
    );
  }

  // Gram-Schmidt a seeded vector against the base. Retry on the rare draw that
  // is nearly parallel to the base, where subtracting the projection leaves only
  // rounding noise and the normalised remainder is meaningless.
  let o: Float64Array | null = null;
  const start = hashSeed(seed);
  for (let attempt = 0; attempt < 16; attempt++) {
    const r = unit64(dims, (start + attempt * 0x85ebca6b) >>> 0);
    const proj = dot(r, b);
    for (let i = 0; i < dims; i++) r[i] -= proj * b[i];
    const nr = norm(r);
    if (nr > 1e-3) {
      for (let i = 0; i < dims; i++) r[i] /= nr;
      o = r;
      break;
    }
  }
  if (!o) throw new Error("vectorAt: could not find a direction orthogonal to base");

  const out = new Float32Array(dims);
  for (let i = 0; i < dims; i++) out[i] = targetCosine * b[i] + s * o[i];
  return out;
}

/** One `embed` call that has been made and not yet settled. */
export type PendingEmbedCall = {
  /** Call ordinal, 0-based and stable for the life of the fake. */
  readonly index: number;
  readonly texts: readonly string[];
};

export type FakeEmbedderOptions = {
  /** Hand-written vectors, by exact text. Anything absent gets a pseudo-vector. */
  vectors?: ReadonlyMap<string, Float32Array> | Readonly<Record<string, Float32Array>>;
  /** Dimensions for generated pseudo-vectors. Hand-written ones are used as given. */
  dims?: number;
  /**
   * `immediate` settles on a microtask, like a fast worker. `manual` holds every
   * call open until the test settles it by index, which is the only way to make
   * two in-flight scans return out of order (T2.6.6).
   */
  resolve?: "immediate" | "manual";
  /** Reject every call with this, for T2.6.8's no-throw guarantee. */
  rejectWith?: unknown;
  /**
   * Per-call rejection. Return `undefined` to let a call resolve normally, or any
   * other value to reject with it. Lets a test fail the second of two scans.
   */
  rejectOn?: (texts: readonly string[], callIndex: number) => unknown;
};

/**
 * An `Embed` with test controls hung off it. It stays callable as a plain `Embed`
 * so it can be handed to `createScanner` unchanged, which is the whole point: the
 * production call site is never aware a fake exists.
 */
export type FakeEmbedder = Embed & {
  /** How many times `embed` was called. Zero is assertable, which is what T2.3 needs. */
  readonly calls: number;
  /** The argument of each call, in call order. */
  readonly callTexts: readonly (readonly string[])[];
  /** Calls still open, oldest first. Empty in `immediate` mode by the next tick. */
  readonly pending: readonly PendingEmbedCall[];
  /** The vector this fake will return for `text`, without calling it. */
  vectorFor(text: string): Float32Array;
  /**
   * Settle one open call with the outcome fixed when it was made, then drain the
   * microtask queue so the caller's continuation has run before the test asserts.
   */
  settle(callIndex: number): Promise<void>;
  /** Settle several calls in exactly the order given. Deliberately not sorted. */
  settleInOrder(...callIndices: number[]): Promise<void>;
  /** Force one open call to reject, whatever its original outcome was. */
  fail(callIndex: number, error?: unknown): Promise<void>;
  /** Resolves once at least `n` calls have been made. */
  whenCalled(n: number): Promise<void>;
};

type Outcome = { kind: "resolve" } | { kind: "reject"; error: unknown };

type CallRecord = {
  index: number;
  texts: readonly string[];
  vectors: Float32Array[];
  outcome: Outcome;
  settled: boolean;
  resolve: (vectors: Float32Array[]) => void;
  reject: (error: unknown) => void;
};

/**
 * Let every queued microtask run. A bare `await` only drains one level.
 *
 * Deliberately microtasks and not `setTimeout(0)`. A scanner test that pins the
 * 300ms/600ms debounce runs under `vi.useFakeTimers()`, and a timer-based drain
 * never fires there: `await fake.settle(0)` would hang until the test times out,
 * which reads as a scanner bug rather than a harness one. Promise continuations
 * are microtasks, so a bounded ladder of them flushes any realistic chain. A
 * consumer that genuinely needs a timer to fire should advance its own clock.
 */
async function drain(): Promise<void> {
  for (let i = 0; i < 64; i++) await Promise.resolve();
}

export function fakeEmbedder(opts: FakeEmbedderOptions = {}): FakeEmbedder {
  const known =
    opts.vectors instanceof Map
      ? new Map(opts.vectors)
      : new Map(Object.entries(opts.vectors ?? {}));

  /**
   * Infer dimensions from the fixtures when the caller did not say. A test that
   * hands over 8-dimensional fixtures for readability would otherwise get
   * 384-dimensional pseudo-vectors for every unknown string in the same batch,
   * and the mismatch surfaces deep inside the matcher as a length error or a
   * truncated dot product, not here.
   */
  const first = known.values().next();
  const dims = opts.dims ?? (first.done ? EMBEDDING_DIMS : first.value.length);
  for (const [text, vector] of known) {
    if (vector.length !== dims) {
      throw new Error(
        `fakeEmbedder: vector for ${JSON.stringify(text)} has ${vector.length} dims, expected ${dims}`,
      );
    }
  }

  const manual = opts.resolve === "manual";

  const records: CallRecord[] = [];
  const waiters: { n: number; resolve: () => void }[] = [];

  /**
   * Hand-written vectors are returned by reference rather than copied. If some
   * code path normalises in place the fixture visibly corrupts, and that is a bug
   * worth failing on rather than hiding behind a defensive clone.
   */
  const vectorFor = (text: string): Float32Array => known.get(text) ?? pseudoVector(text, dims);

  const impl = (texts: string[]): Promise<Float32Array[]> => {
    const index = records.length;
    const outcome: Outcome = ((): Outcome => {
      const perCall = opts.rejectOn?.(texts, index);
      if (perCall !== undefined) return { kind: "reject", error: perCall };
      if (opts.rejectWith !== undefined) return { kind: "reject", error: opts.rejectWith };
      return { kind: "resolve" };
    })();

    // Snapshot the argument: callers are free to mutate or reuse the array they
    // passed, and a test asserting on call arguments must see what was sent.
    const snapshot = [...texts];
    const vectors = snapshot.map(vectorFor);

    let record: CallRecord;
    const promise = new Promise<Float32Array[]>((resolve, reject) => {
      record = {
        index,
        texts: snapshot,
        vectors,
        outcome,
        settled: false,
        resolve,
        reject,
      };
    });
    records.push(record!);

    for (const w of waiters.splice(0)) {
      if (records.length >= w.n) w.resolve();
      else waiters.push(w);
    }

    if (!manual) settleRecord(record!);
    return promise;
  };

  function settleRecord(record: CallRecord): void {
    record.settled = true;
    if (record.outcome.kind === "reject") record.reject(record.outcome.error);
    else record.resolve(record.vectors);
  }

  function open(callIndex: number): CallRecord {
    const record = records[callIndex];
    if (!record) {
      throw new Error(
        `fakeEmbedder: no call ${callIndex}; ${records.length} call(s) have been made`,
      );
    }
    if (record.settled) throw new Error(`fakeEmbedder: call ${callIndex} already settled`);
    return record;
  }

  const controls = {
    vectorFor,
    async settle(callIndex: number): Promise<void> {
      settleRecord(open(callIndex));
      await drain();
    },
    async settleInOrder(...callIndices: number[]): Promise<void> {
      for (const i of callIndices) {
        settleRecord(open(i));
        await drain();
      }
    },
    async fail(callIndex: number, error?: unknown): Promise<void> {
      const record = open(callIndex);
      record.outcome = {
        kind: "reject",
        error: error ?? new Error(`fakeEmbedder: injected failure on call ${callIndex}`),
      };
      settleRecord(record);
      await drain();
    },
    whenCalled(n: number): Promise<void> {
      if (records.length >= n) return Promise.resolve();
      return new Promise<void>((resolve) => waiters.push({ n, resolve }));
    },
  };

  Object.defineProperties(impl, {
    calls: { get: () => records.length, enumerable: true },
    callTexts: { get: () => records.map((r) => r.texts), enumerable: true },
    pending: {
      get: () =>
        records.filter((r) => !r.settled).map((r) => ({ index: r.index, texts: r.texts })),
      enumerable: true,
    },
  });

  return Object.assign(impl, controls) as FakeEmbedder;
}
