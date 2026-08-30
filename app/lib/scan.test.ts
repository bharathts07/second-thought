/**
 * T2.6.9. Every case here is one the plan says must be tested and none of them is
 * reachable without an injectable embedder (F28): all but one shipped rule is
 * semantic, so `skipSemantic: true` leaves nothing to threshold, nothing to
 * de-duplicate, and no race to lose.
 *
 * The embedder is `fakeEmbedder` with constructed vectors, so a threshold
 * assertion is exact and a resolve order is chosen rather than raced. Vectors are
 * 384-wide even though nothing here depends on the width: at that dimension two
 * unrelated seeded vectors sit near-orthogonal, so an untuned segment cannot drift
 * over a rule threshold and invent a finding.
 */

import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMS } from "./model";
import { COMPANY_RULES } from "./policies";
import {
  DEBOUNCE_MS,
  DEBOUNCE_MS_WASM,
  createScanner,
  debounceMs,
  effectiveRules,
} from "./scan";
import { embeddingText } from "./segment";
import { fakeEmbedder, unitVector, vectorAt } from "./test-embedder";
import type { FakeEmbedderOptions } from "./test-embedder";
import type { PolicyRule, Recipient } from "./types";

const DIMS = EMBEDDING_DIMS;

const EXTERNAL: Recipient = {
  kind: "external-domain",
  label: "example.com",
  domain: "example.com",
};
const INTERNAL: Recipient = { kind: "internal", label: "your team" };

/** A segment tuned to score exactly `score` against one rule's exemplars. */
type Tuning = { text: string; ruleId: string; score: number };

/**
 * Build a fake embedder and an exemplar map from a list of tunings.
 *
 * Every semantic rule in `rules` gets an exemplar vector, so no rule is evaluated
 * against an empty map: an untuned rule sits near-orthogonal to everything and
 * stays quiet, which is what a real rule that does not apply looks like.
 */
function harness(
  rules: readonly PolicyRule[],
  tunings: readonly Tuning[],
  embedOpts: FakeEmbedderOptions = {},
) {
  const vectors = new Map<string, Float32Array>();
  const exemplars = new Map<string, Float32Array[]>();

  for (const rule of rules) {
    if (rule?.match?.kind === "semantic") {
      exemplars.set(rule.id, [unitVector(DIMS, `unrelated:${rule.id}`)]);
    }
  }
  for (const { text, ruleId, score } of tunings) {
    const key = embeddingText(text);
    const segmentVector = vectors.get(key) ?? unitVector(DIMS, `segment:${key}`);
    vectors.set(key, segmentVector);
    const tuned = vectorAt(segmentVector, score, `${ruleId}:${key}`);
    exemplars.set(ruleId, [...(exemplars.get(ruleId) ?? []), tuned]);
  }

  const embed = fakeEmbedder({ vectors, dims: DIMS, ...embedOpts });
  const scanner = createScanner({ embed, exemplars, rules: [...rules] });
  return { embed, exemplars, scanner };
}

/** A personal terms rule, for the cases where both rungs claim the same words. */
function termRule(term: string, severity: PolicyRule["severity"]): PolicyRule {
  return {
    id: "personal-phrase",
    source: "personal",
    enabled: true,
    title: "A phrase I do not want to send",
    category: "claim",
    severity,
    appliesTo: ["external-guest", "external-domain"],
    match: { kind: "terms", terms: [term], wholeWord: false },
    why: "Because I decided this one is mine to catch.",
  };
}

const RESIDENCY_DRAFT = "we guarantee your data never leaves the US";
const REFUSAL_DRAFT = "we cannot guarantee your data never leaves the US";
/** F8's regression sentence: a one-word low span inside a high-severity clause. */
const DAMN_DRAFT = "Yes, we damn well guarantee your data never leaves the US.";

describe("the exposed timing constants (T2.6.5)", () => {
  it("names both debounce values so the UI does not invent them", () => {
    expect(DEBOUNCE_MS).toBe(300);
    expect(DEBOUNCE_MS_WASM).toBe(600);
    expect(debounceMs("webgpu")).toBe(DEBOUNCE_MS);
    expect(debounceMs("wasm")).toBe(DEBOUNCE_MS_WASM);
    expect(debounceMs(undefined)).toBe(DEBOUNCE_MS);
  });
});

describe("the context gate (T2.3, F10)", () => {
  it("filters per rule rather than switching everything off internally", () => {
    const internal = effectiveRules(COMPANY_RULES, "internal").map((r) => r.id);
    // Tone and language apply inside the company; the six external rules do not.
    expect(internal).toEqual(["harsh-criticism", "strong-language"]);
    expect(effectiveRules(COMPANY_RULES, "external-domain")).toHaveLength(
      COMPANY_RULES.length,
    );
  });

  it("drops a disabled rule and survives a malformed one", () => {
    const rules = [
      { ...COMPANY_RULES[0], enabled: false },
      null as unknown as PolicyRule,
      COMPANY_RULES[7],
    ];
    expect(effectiveRules(rules, "external-domain").map((r) => r.id)).toEqual([
      "strong-language",
    ]);
    expect(effectiveRules(undefined, "internal")).toEqual([]);
  });
});

describe("the threshold, through the whole pipeline", () => {
  it("fires just above and stays silent just below", async () => {
    const above = harness(COMPANY_RULES, [
      { text: RESIDENCY_DRAFT, ruleId: "residency-promise", score: 0.601 },
    ]);
    const hit = await above.scanner.scan(RESIDENCY_DRAFT, EXTERNAL);
    expect(hit.findings.map((f) => f.ruleId)).toEqual(["residency-promise"]);
    expect(hit.findings[0].score).toBeCloseTo(0.601, 5);
    expect(hit.ranSemantic).toBe(true);
    expect(hit.truncated).toBe(false);

    const below = harness(COMPANY_RULES, [
      { text: RESIDENCY_DRAFT, ruleId: "residency-promise", score: 0.599 },
    ]);
    const miss = await below.scanner.scan(RESIDENCY_DRAFT, EXTERNAL);
    expect(miss.findings).toEqual([]);
    // Silence with the rung having run is a different claim from silence because
    // it did not, and the UI says two different things about them.
    expect(miss.ranSemantic).toBe(true);
  });
});

describe("the cue and negator gate at identical cosine (F1)", () => {
  it("flags the promise and stays silent on the refusal", async () => {
    const score = 0.978;
    const promise = harness(COMPANY_RULES, [
      { text: RESIDENCY_DRAFT, ruleId: "residency-promise", score },
    ]);
    const refusal = harness(COMPANY_RULES, [
      { text: REFUSAL_DRAFT, ruleId: "residency-promise", score },
    ]);

    const flagged = await promise.scanner.scan(RESIDENCY_DRAFT, EXTERNAL);
    const quiet = await refusal.scanner.scan(REFUSAL_DRAFT, EXTERNAL);

    expect(flagged.findings.map((f) => f.ruleId)).toEqual(["residency-promise"]);
    expect(flagged.findings[0].score).toBeCloseTo(score, 5);
    // Measured, the refusal outscores the promise on the real model. Both are at
    // 0.978 here, and only the negator differs, so nothing but the gate can be
    // what separates them.
    expect(quiet.findings).toEqual([]);
    expect(quiet.ranSemantic).toBe(true);
  });
});

describe("dedupe precedence (T2.6.3, F8)", () => {
  it("renders the high semantic card, not the low term card inside it", async () => {
    const { scanner } = harness(COMPANY_RULES, [
      { text: DAMN_DRAFT, ruleId: "residency-promise", score: 0.9 },
    ]);
    const result = await scanner.scan(DAMN_DRAFT, EXTERNAL);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].ruleId).toBe("residency-promise");
    expect(result.findings[0].severity).toBe("high");
    expect(result.findings[0].source).toBe("semantic");
  });

  it("shows the term card when the term rule is not tuned out by severity", async () => {
    // The same draft with the semantic rule scoring below its threshold: the low
    // card is the honest remaining finding rather than a consolation prize.
    const { scanner } = harness(COMPANY_RULES, [
      { text: DAMN_DRAFT, ruleId: "residency-promise", score: 0.2 },
    ]);
    const result = await scanner.scan(DAMN_DRAFT, EXTERNAL);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["strong-language"]);
    expect(result.findings[0].source).toBe("pattern");
  });

  it("prefers the pattern rung at EQUAL severity on a co-extensive span", async () => {
    const rules = [...COMPANY_RULES, termRule(RESIDENCY_DRAFT, "high")];
    const { scanner } = harness(rules, [
      { text: RESIDENCY_DRAFT, ruleId: "residency-promise", score: 0.99 },
    ]);
    const result = await scanner.scan(RESIDENCY_DRAFT, EXTERNAL);
    expect(result.findings).toHaveLength(1);
    // Equal severity, near-identical spans: certainty wins, and it is easier to
    // explain than a cosine. At UNequal severity this preference does not apply.
    expect(result.findings[0].source).toBe("pattern");
    expect(result.findings[0].ruleId).toBe("personal-phrase");
  });

  it("keeps both findings when the spans only clip each other", async () => {
    const draft = "we guarantee your data never leaves the US, and everyone here agrees";
    const rules = [...COMPANY_RULES, termRule("the US, and everyone", "low")];
    const { scanner } = harness(rules, [
      { text: "we guarantee your data never leaves the US", ruleId: "residency-promise", score: 0.9 },
    ]);
    const result = await scanner.scan(draft, EXTERNAL);
    // Neither span contains the other and they share well under 80% of the longer
    // one, so they are two things worth saying rather than one said twice.
    expect(result.findings.map((f) => f.ruleId)).toEqual([
      "residency-promise",
      "personal-phrase",
    ]);
  });
});

describe("the internal recipient", () => {
  const COMMITMENT_DRAFT = "we will have that shipped before you renew";
  const TONE_DRAFT = "whoever wrote this clearly had no idea what they were doing";

  it("produces no findings and never touches the encoder when no rule in scope is semantic", async () => {
    const rules = COMPANY_RULES.filter((r) => r.id !== "harsh-criticism");
    const { embed, scanner } = harness(rules, [
      { text: COMMITMENT_DRAFT, ruleId: "delivery-date-commitment", score: 0.99 },
    ]);
    const result = await scanner.scan(COMMITMENT_DRAFT, INTERNAL);
    expect(result.findings).toEqual([]);
    expect(embed.calls).toBe(0);
    // Nothing was skipped that could have flagged, so this is not a degraded scan.
    expect(result.ranSemantic).toBe(true);
  });

  it("fires a tone rule internally, which is why the gate cannot be a master switch", async () => {
    const { embed, scanner } = harness(COMPANY_RULES, [
      { text: TONE_DRAFT, ruleId: "harsh-criticism", score: 0.9 },
    ]);
    const result = await scanner.scan(TONE_DRAFT, INTERNAL);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["harsh-criticism"]);
    expect(result.findings[0].category).toBe("tone");
    expect(embed.calls).toBe(1);
  });

  it("keeps the residency rule external-only, which is the recipient-switch moment", async () => {
    const { scanner } = harness(COMPANY_RULES, [
      { text: RESIDENCY_DRAFT, ruleId: "residency-promise", score: 0.99 },
    ]);
    expect((await scanner.scan(RESIDENCY_DRAFT, EXTERNAL)).findings).toHaveLength(1);
    expect((await scanner.scan(RESIDENCY_DRAFT, INTERNAL)).findings).toEqual([]);
  });
});

describe("the labour-relations exclusion (T2.1.7, D23)", () => {
  const LABOUR =
    "whoever set this on-call schedule clearly had no idea what it takes, so I can get you thirty percent off the overtime tooling";
  const CONTROL =
    "whoever wrote this clearly had no idea what it takes, so I can get you thirty percent off the tooling";

  it("suppresses the tone finding and keeps the pricing commitment in the same sentence", async () => {
    const { scanner } = harness(COMPANY_RULES, [
      {
        text: "whoever set this on-call schedule clearly had no idea what it takes",
        ruleId: "harsh-criticism",
        score: 0.95,
      },
      {
        text: "so I can get you thirty percent off the overtime tooling",
        ruleId: "pricing-commitment",
        score: 0.95,
      },
    ]);
    const result = await scanner.scan(LABOUR, EXTERNAL);
    // Silently: no downgrade, no log, no "suppressed" affordance. An affordance
    // saying "we noticed something and chose not to say it" is its own chilling
    // effect.
    expect(result.findings.map((f) => f.category)).toEqual(["commitment"]);
    expect(result.findings[0].ruleId).toBe("pricing-commitment");
  });

  it("fires the same tone finding once the labour topic is gone", async () => {
    const { scanner } = harness(COMPANY_RULES, [
      {
        text: "whoever wrote this clearly had no idea what it takes",
        ruleId: "harsh-criticism",
        score: 0.95,
      },
      {
        text: "so I can get you thirty percent off the tooling",
        ruleId: "pricing-commitment",
        score: 0.95,
      },
    ]);
    const result = await scanner.scan(CONTROL, EXTERNAL);
    expect(result.findings.map((f) => f.ruleId).sort()).toEqual([
      "harsh-criticism",
      "pricing-commitment",
    ]);
  });

  it("suppresses a language finding on a labour sentence", async () => {
    const draft = "this on-call rota is a damn mess and nobody asked us";
    const { scanner } = harness(COMPANY_RULES, []);
    expect((await scanner.scan(draft, EXTERNAL)).findings).toEqual([]);
    const clean = "this slide deck is a damn mess and nobody asked us";
    expect((await scanner.scan(clean, EXTERNAL)).findings.map((f) => f.ruleId)).toEqual([
      "strong-language",
    ]);
  });
});

describe("negation on the deterministic rung (T2.1.6b.4)", () => {
  it("stays silent on a refusal to move off the record, and fires on the invitation", async () => {
    const { scanner } = harness(COMPANY_RULES, []);
    // Without the predicate wired through, the phrase list fires here with no
    // model involved and tells someone they moved the conversation off the record
    // when they refused to.
    const refusal = await scanner.scan(
      "I can't move this to my personal phone, sorry",
      EXTERNAL,
    );
    expect(refusal.findings).toEqual([]);
    const invitation = await scanner.scan("let's move this to my personal phone", EXTERNAL);
    expect(invitation.findings.map((f) => f.ruleId)).toEqual(["moving-off-record"]);
  });
});

describe("a rule the semantic rung cannot evaluate (T2.6.8)", () => {
  it("says the rung did not run rather than reporting a clean draft", async () => {
    // A stale exemplar cache: the rule is in scope and cued, and there is nothing
    // to compare it against. Contained per rule, so the pattern rung still
    // reports, but `ranSemantic` must not claim the semantic rung finished.
    const { scanner } = harness(COMPANY_RULES, [
      { text: DAMN_DRAFT, ruleId: "residency-promise", score: 0.99 },
    ]);
    const missing = createScanner({
      embed: fakeEmbedder({ dims: DIMS }),
      exemplars: new Map(),
      rules: [...COMPANY_RULES],
    });
    const result = await missing.scan(DAMN_DRAFT, EXTERNAL);
    expect(result.ranSemantic).toBe(false);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["strong-language"]);
    // The same draft with the vectors present is not degraded, so the flag tracks
    // the failure rather than the draft.
    expect((await scanner.scan(DAMN_DRAFT, EXTERNAL)).ranSemantic).toBe(true);
  });

  it("says the rung did not run when a rule's threshold is not a number", async () => {
    const broken = {
      ...COMPANY_RULES[0],
      match: { ...COMPANY_RULES[0].match, threshold: "0.6" },
    } as unknown as PolicyRule;
    const { scanner } = harness([broken], [
      { text: RESIDENCY_DRAFT, ruleId: broken.id, score: 0.99 },
    ]);
    const result = await scanner.scan(RESIDENCY_DRAFT, EXTERNAL);
    expect(result.findings).toEqual([]);
    expect(result.ranSemantic).toBe(false);
  });
});

describe("the same sentence twice (F9)", () => {
  it("renders one card per occurrence, each slicing back to its own span", async () => {
    const sentence = "We guarantee your data never leaves the US.";
    const draft = `${sentence} Legal will confirm. ${sentence}`;
    const { scanner } = harness(COMPANY_RULES, [
      // One tuning, two segments: byte-identical text embeds to the same vector,
      // which is exactly the case where `matchedText` is not an identity.
      { text: sentence, ruleId: "residency-promise", score: 0.9 },
    ]);
    const result = await scanner.scan(draft, EXTERNAL);
    // Two spans, neither containing the other, so dedupe must not collapse them:
    // the duplicate text is not one finding said twice.
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].start).toBeLessThan(result.findings[1].start);
    for (const finding of result.findings) {
      expect(draft.slice(finding.start, finding.end)).toBe(finding.matchedText);
    }
  });
});

describe("out-of-order results (T2.6.6)", () => {
  it("discards the superseded scan when two in-flight scans settle in reverse", async () => {
    const second = "we will have that shipped before you renew";
    const { embed, scanner } = harness(
      COMPANY_RULES,
      [
        { text: RESIDENCY_DRAFT, ruleId: "residency-promise", score: 0.9 },
        { text: second, ruleId: "delivery-date-commitment", score: 0.9 },
      ],
      { resolve: "manual" },
    );

    const first = scanner.scan(RESIDENCY_DRAFT, EXTERNAL);
    const latest = scanner.scan(second, EXTERNAL);
    await embed.whenCalled(2);
    // The later scan comes back first, which is the ordinary case on WASM when a
    // long draft is followed by a short one.
    await embed.settleInOrder(1, 0);

    const [stale, current] = await Promise.all([first, latest]);
    expect(current.superseded).toBe(false);
    expect(current.findings.map((f) => f.ruleId)).toEqual(["delivery-date-commitment"]);
    // Discarded rather than returned: rendering it would put a card under a draft
    // the person has already edited away.
    expect(stale.superseded).toBe(true);
    expect(stale.findings).toEqual([]);
    expect(stale.seq).toBeLessThan(current.seq);
  });
});

describe("failures never reach the caller (T2.6.8)", () => {
  it("resolves with the pattern findings and ranSemantic false when embed rejects", async () => {
    const { scanner } = harness(
      COMPANY_RULES,
      [{ text: DAMN_DRAFT, ruleId: "residency-promise", score: 0.99 }],
      { rejectWith: new Error("worker died") },
    );
    const result = await scanner.scan(DAMN_DRAFT, EXTERNAL);
    expect(result.ranSemantic).toBe(false);
    // The rung that needs no model still did its job, and the result says plainly
    // that the other one did not.
    expect(result.findings.map((f) => f.ruleId)).toEqual(["strong-language"]);
  });

  it("survives a term containing regex metacharacters", async () => {
    const rules = [...COMPANY_RULES, termRule("f**k", "low")];
    const { scanner } = harness(rules, []);
    const result = await scanner.scan("this f**k of a build is broken again", EXTERNAL);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["personal-phrase"]);
    expect(result.findings[0].matchedText).toBe("f**k");
  });

  it("survives a rule with no match block, a null rule set, and a null recipient", async () => {
    const broken = { id: "broken", source: "personal", enabled: true } as unknown as PolicyRule;
    const { scanner } = harness([...COMPANY_RULES, broken], []);
    await expect(scanner.scan("this is a perfectly ordinary sentence", EXTERNAL)).resolves.toMatchObject(
      { findings: [] },
    );

    const nullish = createScanner({
      embed: fakeEmbedder({ dims: DIMS }),
      exemplars: new Map(),
      rules: null as unknown as PolicyRule[],
    });
    await expect(
      nullish.scan("this is a perfectly ordinary sentence", null as unknown as Recipient),
    ).resolves.toMatchObject({ findings: [], ranSemantic: true });
  });

  it("resolves with an empty result on an empty draft", async () => {
    const { embed, scanner } = harness(COMPANY_RULES, []);
    const result = await scanner.scan("", EXTERNAL);
    expect(result).toMatchObject({ findings: [], truncated: false, ranSemantic: true });
    expect(embed.calls).toBe(0);
  });
});

describe("skipSemantic (T2.6.7)", () => {
  it("runs the pattern rung only, and says the semantic rung did not run", async () => {
    const { embed, scanner } = harness(COMPANY_RULES, [
      { text: DAMN_DRAFT, ruleId: "residency-promise", score: 0.99 },
    ]);
    const result = await scanner.scan(DAMN_DRAFT, EXTERNAL, { skipSemantic: true });
    expect(embed.calls).toBe(0);
    expect(result.ranSemantic).toBe(false);
    expect(result.findings.map((f) => f.ruleId)).toEqual(["strong-language"]);
  });
});

describe("offsets, ordering, and truncation", () => {
  it("keeps every finding's span in agreement with its text", async () => {
    const draft =
      "Text me on my cell. My key is sk-ABCDEFGHIJKLMNOP12. We guarantee your data never leaves the US.";
    const { scanner } = harness(COMPANY_RULES, [
      {
        text: "We guarantee your data never leaves the US.",
        ruleId: "residency-promise",
        score: 0.9,
      },
    ]);
    const result = await scanner.scan(draft, EXTERNAL);
    expect(result.findings.length).toBeGreaterThan(2);
    for (const finding of result.findings) {
      expect(draft.slice(finding.start, finding.end)).toBe(finding.matchedText);
    }
    expect(result.findings.map((f) => f.ruleId)).toContain("secret-api-key");
    expect(result.findings.map((f) => f.ruleId)).toContain("moving-off-record");
  });

  it("sorts by severity, then by start", async () => {
    const draft = "This is a damn mess. We guarantee your data never leaves the US.";
    const { scanner } = harness(COMPANY_RULES, [
      {
        text: "We guarantee your data never leaves the US.",
        ruleId: "residency-promise",
        score: 0.9,
      },
    ]);
    const result = await scanner.scan(draft, EXTERNAL);
    // The high finding starts later in the draft and still comes first.
    expect(result.findings.map((f) => [f.severity, f.start])).toEqual([
      ["high", 21],
      ["low", 10],
    ]);
  });

  it("takes truncated from segmentation and embeds only the segments it scanned", async () => {
    const draft = Array.from({ length: 45 }, (_, i) => `this is sentence number ${i}.`).join(" ");
    const { embed, scanner } = harness(COMPANY_RULES, []);
    const result = await scanner.scan(draft, EXTERNAL);
    expect(result.truncated).toBe(true);
    expect(embed.callTexts[0]).toHaveLength(40);
    expect(result.findings).toEqual([]);
  });
});

/**
 * Controller-added, covering two silent-false-negative paths that the module's
 * own tests left open. Both were reported honestly by review rather than found
 * by a failing test, which is exactly why they are pinned here now.
 */
describe("failing safe rather than failing quiet", () => {
  it("an unrecognised recipient scopes to the most protective context, not to nothing", () => {
    // Before: an unknown kind returned zero rules, so the scan reported a clean
    // draft. Silence that reads as approval is the worst output this engine has.
    const unknown = effectiveRules(COMPANY_RULES, "sales-channel" as never);
    const external = effectiveRules(COMPANY_RULES, "external-domain");
    expect(unknown.map((r) => r.id)).toEqual(external.map((r) => r.id));
    expect(unknown.length).toBeGreaterThan(0);

    const missing = effectiveRules(COMPANY_RULES, undefined);
    expect(missing.map((r) => r.id)).toEqual(external.map((r) => r.id));
  });

  it("reports ranPattern false when a term rule cannot be evaluated", async () => {
    // A user-authored term rule is the likeliest thing here to be malformed.
    // Containing it per rule is right; reporting the draft clean afterwards is not.
    const malformed = {
      id: "personal:broken-terms",
      source: "personal",
      enabled: true,
      title: "Broken",
      category: "language",
      severity: "low",
      appliesTo: ["external-domain"],
      match: { kind: "terms", terms: null, wholeWord: true },
      why: "n/a",
    } as unknown as PolicyRule;

    const scanner = createScanner({
      embed: fakeEmbedder({ vectors: {} }),
      exemplars: new Map(),
      rules: [malformed],
    });
    const result = await scanner.scan("an entirely ordinary sentence about nothing", {
      kind: "external-domain",
      label: "example.com",
    });
    expect(result.ranPattern).toBe(false);
  });

  it("reports ranPattern true on a healthy rule set", async () => {
    const scanner = createScanner({
      embed: fakeEmbedder({ vectors: {} }),
      exemplars: new Map(),
      rules: COMPANY_RULES,
      });
    const result = await scanner.scan("an entirely ordinary sentence about nothing", {
      kind: "external-domain",
      label: "example.com",
    });
    expect(result.ranPattern).toBe(true);
  });
});
