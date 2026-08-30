/**
 * T2.5. Every vector here is constructed rather than measured, so a threshold
 * assertion pins behaviour at 0.001 either side of a boundary and a failure
 * reproduces on any machine.
 *
 * The centre of this file is the cue gate at IDENTICAL cosine. That is the F1
 * regression: on the real model a negated refusal scores 0.978 against the
 * residency exemplars while the affirmative promise scores 0.964, so a bare
 * threshold flags the careful writer harder than the risky one. Holding the score
 * fixed and varying only the negator is the only way to test that the gate, rather
 * than the arithmetic, is what separates them.
 */

import { describe, expect, it } from "vitest";
import { COMPANY_RULES } from "./policies";
import { matchSemantic, severityRank, ungovernedCue } from "./semantic";
import { segment } from "./segment";
import { unitVector, vectorAt } from "./test-embedder";
import type { Finding, PolicyRule, Segment } from "./types";

/** Eight dimensions rather than 384: nothing here depends on the width. */
const DIMS = 8;

const RESIDENCY_BASE = unitVector(DIMS, "residency-exemplar");

function semanticRule(over: Partial<PolicyRule> & { id: string }): PolicyRule {
  return {
    source: "company",
    enabled: true,
    title: "A rule",
    category: "claim",
    severity: "high",
    appliesTo: ["external-guest", "external-domain"],
    match: { kind: "semantic", cues: ["guarantee"], exemplars: ["x"], threshold: 0.6 },
    why: "Because.",
    replacement: "Something safer.",
    ...over,
  };
}

/** The rule under test in most cases: high severity, one cue, one exemplar. */
const R1: PolicyRule = semanticRule({
  id: "residency-promise",
  match: {
    kind: "semantic",
    cues: ["guarantee", "never leaves"],
    exemplars: ["we guarantee your data never leaves the US"],
    threshold: 0.6,
  },
});

const TONE: PolicyRule = semanticRule({
  id: "harsh-criticism",
  title: "This reads as criticism of a person",
  category: "tone",
  severity: "medium",
  appliesTo: ["internal", "external-guest", "external-domain"],
  match: {
    kind: "semantic",
    cues: ["stupid", "no idea"],
    exemplars: ["this is a stupid way to do it"],
    threshold: 0.6,
  },
});

function only(draft: string): Segment[] {
  const segments = segment(draft).segments;
  expect(segments).toHaveLength(1);
  return segments;
}

function run(
  draft: string,
  rules: PolicyRule[],
  vectors: Float32Array[],
  exemplars: Map<string, Float32Array[]>,
  onRuleError?: (ruleId: string, error: unknown) => void,
): Finding[] {
  return matchSemantic(segment(draft).segments, rules, vectors, exemplars, { onRuleError });
}

const R1_VECTORS = new Map([["residency-promise", [RESIDENCY_BASE]]]);

describe("severityRank", () => {
  it("orders high before medium before low", () => {
    expect(severityRank("high")).toBeLessThan(severityRank("medium"));
    expect(severityRank("medium")).toBeLessThan(severityRank("low"));
  });
});

describe("the threshold comparison", () => {
  const draft = "we guarantee your data never leaves the US";

  it("fires just above the threshold", () => {
    const found = run(draft, [R1], [vectorAt(RESIDENCY_BASE, 0.601)], R1_VECTORS);
    expect(found).toHaveLength(1);
    expect(found[0].ruleId).toBe("residency-promise");
    expect(found[0].score).toBeCloseTo(0.601, 5);
    expect(found[0].source).toBe("semantic");
  });

  it("stays silent just below the threshold", () => {
    expect(run(draft, [R1], [vectorAt(RESIDENCY_BASE, 0.599)], R1_VECTORS)).toEqual([]);
  });

  it("fires AT the threshold, because T2.5.3 says >= and not >", () => {
    // Hand-built rather than `vectorAt`, because equality has to be exact and the
    // Float32 round trip in `vectorAt` lands a hair either side of the target. A
    // unit basis vector against a half-length copy of itself dots to exactly 0.5
    // in both float32 and float64, so the boundary is the boundary.
    const at = semanticRule({
      id: "residency-promise",
      match: { kind: "semantic", cues: ["guarantee"], exemplars: ["x"], threshold: 0.5 },
    });
    const vector = new Float32Array(DIMS);
    vector[0] = 1;
    const exemplar = new Float32Array(DIMS);
    exemplar[0] = 0.5;
    const found = run(draft, [at], [vector], new Map([["residency-promise", [exemplar]]]));
    expect(found).toHaveLength(1);
    expect(found[0].score).toBe(0.5);
  });

  it("takes the max across exemplars, not the first or the mean", () => {
    const vector = unitVector(DIMS, "segment-vector");
    // Far from the first exemplar, close to the second. A first-exemplar-only
    // comparison misses this; a mean-of-exemplars comparison lands at 0.5 and
    // misses it too.
    const exemplars = new Map([
      ["residency-promise", [vectorAt(vector, 0.1, "a"), vectorAt(vector, 0.95, "b")]],
    ]);
    const found = run(draft, [R1], [vector], exemplars);
    expect(found).toHaveLength(1);
    expect(found[0].score).toBeCloseTo(0.95, 5);
  });
});

describe("the cue and negator gate (F1)", () => {
  it("fires on the affirmative promise and stays silent on the refusal, at identical cosine", () => {
    const affirmative = "we guarantee your data never leaves the US";
    const refusal = "we cannot guarantee your data never leaves the US";
    const score = 0.978;

    const flagged = run(affirmative, [R1], [vectorAt(RESIDENCY_BASE, score)], R1_VECTORS);
    const quiet = run(refusal, [R1], [vectorAt(RESIDENCY_BASE, score)], R1_VECTORS);

    expect(flagged).toHaveLength(1);
    expect(flagged[0].score).toBeCloseTo(score, 5);
    // Same score, no finding. The gate is doing the work, not the arithmetic.
    expect(quiet).toEqual([]);
  });

  it("stays silent when no cue is present at all, however high the score", () => {
    const draft = "our security team can walk you through the residency options";
    expect(run(draft, [R1], [vectorAt(RESIDENCY_BASE, 0.999)], R1_VECTORS)).toEqual([]);
  });

  it("sees a cue through markdown emphasis", () => {
    expect(ungovernedCue("we **guarantee** it stays put", ["guarantee"])).toBe("guarantee");
  });

  it("sees a multi-word cue that markup splits, which the raw string does not contain", () => {
    // The emphasis case above passes against the raw draft too, so on its own it
    // does not prove the presence test runs on `embeddingText`. Here the raw draft
    // contains no substring `never leaves` at all, and a rule that reads the draft
    // directly is simply dead on an emphasised promise.
    const emphasised = "we guarantee your data never **leaves** the US";
    expect(emphasised.includes("never leaves")).toBe(false);
    expect(ungovernedCue(emphasised, ["never leaves"])).toBe("never leaves");
    // And the gate still closes on the refusal when the same markup is present.
    expect(ungovernedCue("we cannot **guarantee** that", ["guarantee"])).toBeNull();
  });

  it("fires on an emphasised promise end to end, and keeps the markup in matchedText", () => {
    const draft = "we **guarantee** your data never leaves the US";
    const found = run(draft, [R1], [vectorAt(RESIDENCY_BASE, 0.9)], R1_VECTORS);
    expect(found).toHaveLength(1);
    // The composer highlights and replaces against what the person typed, so the
    // payload carries the raw span including `**`, never the embedding form.
    expect(found[0].matchedText).toContain("**guarantee**");
    expect(draft.slice(found[0].start, found[0].end)).toBe(found[0].matchedText);
  });

  it("reports no ungoverned cue when a negator governs the only cue", () => {
    expect(ungovernedCue("we cannot guarantee that", ["guarantee"])).toBeNull();
  });

  it("tolerates a missing or malformed cue list", () => {
    expect(ungovernedCue("we guarantee it", undefined)).toBeNull();
    expect(ungovernedCue("we guarantee it", [""])).toBeNull();
  });
});

describe("one card per segment (T2.5.5)", () => {
  const bothCued = "this is a stupid way to guarantee anything";

  it("keeps the highest severity when two rules match", () => {
    const segments = only(bothCued);
    const vector = unitVector(DIMS, "both-cued");
    const exemplars = new Map([
      ["residency-promise", [vectorAt(vector, 0.7, "high-rule")]],
      ["harsh-criticism", [vectorAt(vector, 0.99, "medium-rule")]],
    ]);
    const found = matchSemantic(segments, [TONE, R1], [vector], exemplars);
    expect(found).toHaveLength(1);
    // The tone rule scores 0.99 and the residency rule 0.70, yet high beats
    // medium: severity first, score only as the tie-break.
    expect(found[0].ruleId).toBe("residency-promise");
    expect(found[0].score).toBeCloseTo(0.7, 5);
  });

  it("keeps the highest score at equal severity", () => {
    const segments = only(bothCued);
    const sameSeverity = semanticRule({
      id: "other-medium",
      severity: "medium",
      match: {
        kind: "semantic",
        cues: ["guarantee"],
        exemplars: ["x"],
        threshold: 0.6,
      },
    });
    const vector = unitVector(DIMS, "equal-severity");
    const exemplars = new Map([
      ["harsh-criticism", [vectorAt(vector, 0.95, "tone")]],
      ["other-medium", [vectorAt(vector, 0.7, "other")]],
    ]);
    const found = matchSemantic(segments, [sameSeverity, TONE], [vector], exemplars);
    expect(found).toHaveLength(1);
    expect(found[0].ruleId).toBe("harsh-criticism");
    expect(found[0].score).toBeCloseTo(0.95, 5);
  });
});

describe("offsets and payload", () => {
  it("carries the original segment text and offsets that slice back to it", () => {
    const draft = "Hi there. We guarantee your data never leaves the US, and I will send the report.";
    const segments = segment(draft).segments;
    const vectors = segments.map((s) =>
      s.text.includes("guarantee") ? vectorAt(RESIDENCY_BASE, 0.9) : unitVector(DIMS, s.text),
    );
    const found = matchSemantic(segments, [R1], vectors, R1_VECTORS);
    expect(found).toHaveLength(1);
    for (const finding of found) {
      expect(draft.slice(finding.start, finding.end)).toBe(finding.matchedText);
    }
    // The matched text is the clause, not the whole draft: mean pooling dilutes a
    // promise to noise across a longer sentence (F2).
    expect(found[0].matchedText).toBe("We guarantee your data never leaves the US");
    expect(found[0].title).toBe(R1.title);
    expect(found[0].why).toBe(R1.why);
    expect(found[0].replacement).toBe(R1.replacement);
    expect(found[0].category).toBe("claim");
  });
});

describe("rules it must not evaluate", () => {
  const draft = "we guarantee your data never leaves the US";

  it("ignores a disabled rule", () => {
    const rules = [{ ...R1, enabled: false }];
    expect(run(draft, rules, [vectorAt(RESIDENCY_BASE, 0.99)], R1_VECTORS)).toEqual([]);
  });

  it("ignores a terms rule, which belongs to the deterministic rung", () => {
    const terms = COMPANY_RULES.find((r) => r.id === "strong-language");
    expect(terms?.match.kind).toBe("terms");
    expect(run("this is a damn mess entirely", [terms!], [unitVector(DIMS, 1)], new Map())).toEqual(
      [],
    );
  });
});

describe("containment rather than throwing", () => {
  const draft = "we guarantee your data never leaves the US";

  it("reports a rule with no exemplar vectors instead of going quiet", () => {
    const errors: string[] = [];
    const found = run(draft, [R1], [vectorAt(RESIDENCY_BASE, 0.9)], new Map(), (id) =>
      errors.push(id),
    );
    expect(found).toEqual([]);
    expect(errors).toEqual(["residency-promise"]);
  });

  it("reports a rule whose threshold is not a number, and does not invent one", () => {
    const errors: unknown[] = [];
    const broken = {
      ...R1,
      match: { ...R1.match, threshold: undefined as unknown as number },
    } as PolicyRule;
    const found = run(draft, [broken], [vectorAt(RESIDENCY_BASE, 0.99)], R1_VECTORS, (_id, e) =>
      errors.push(e),
    );
    expect(found).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it("costs one rule and not the rung when a rule is malformed", () => {
    const hostile = { id: "hostile", enabled: true } as unknown as PolicyRule;
    const found = run(
      draft,
      [hostile, R1],
      [vectorAt(RESIDENCY_BASE, 0.9)],
      R1_VECTORS,
    );
    expect(found.map((f) => f.ruleId)).toEqual(["residency-promise"]);
  });

  it("reports an exemplar vector of the wrong width", () => {
    const errors: string[] = [];
    const wrong = new Map([["residency-promise", [unitVector(16, "wide")]]]);
    const found = run(draft, [R1], [vectorAt(RESIDENCY_BASE, 0.9)], wrong, (id) =>
      errors.push(id),
    );
    expect(found).toEqual([]);
    expect(errors).toEqual(["residency-promise"]);
  });

  it("throws when the caller passes the wrong number of vectors", () => {
    // A caller contract violation rather than a data condition. `scan` catches it
    // and resolves with `ranSemantic: false`, which is honest; swallowing it here
    // would produce silence that reads as a clean draft.
    expect(() => matchSemantic(only(draft), [R1], [], R1_VECTORS)).toThrow(/vector/);
  });

  it("reports a rule set that is not an array", () => {
    const errors: string[] = [];
    const found = matchSemantic(
      only(draft),
      {} as unknown as PolicyRule[],
      [vectorAt(RESIDENCY_BASE, 0.9)],
      R1_VECTORS,
      { onRuleError: (id) => errors.push(id) },
    );
    expect(found).toEqual([]);
    expect(errors).toEqual(["unknown-rule"]);
  });
});

describe("the real rule set", () => {
  it("gates every shipped semantic rule on a cue, so none can fire on topic alone", () => {
    for (const rule of COMPANY_RULES) {
      if (rule.match.kind !== "semantic") continue;
      expect(rule.match.cues.length).toBeGreaterThan(0);
      const exemplars = new Map([[rule.id, [RESIDENCY_BASE]]]);
      // A sentence in the same topical neighbourhood, with no cue of any rule.
      const found = run(
        "our team can walk you through the options whenever you like",
        [rule],
        [vectorAt(RESIDENCY_BASE, 0.999)],
        exemplars,
      );
      expect(found, rule.id).toEqual([]);
    }
  });

  it("cues the shipped residency rule on the word this file stands in for", () => {
    const shipped = COMPANY_RULES.find((r) => r.id === "residency-promise");
    expect(shipped?.match.kind === "semantic" && shipped.match.cues).toContain("guarantee");
  });
});
