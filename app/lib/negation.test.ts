import { describe, expect, it } from "vitest";

import { isNegated, NEGATOR_WINDOW_TOKENS, NEGATORS } from "./negation";
import { COMPANY_RULES } from "./policies";
import type { PolicyRule } from "@/app/lib/types";

/**
 * The acceptance criterion for T2.1.6b is a shape, not a sample: for every rule,
 * the negated form of each exemplar produces no finding and the affirmative form
 * still does. So this file walks the rule set rather than a hand-picked list, and
 * a new rule or a new exemplar cannot ship without its negation tested.
 */

type SemanticRule = PolicyRule & {
  match: { kind: "semantic"; cues: string[]; exemplars: string[]; threshold: number };
};

const semanticRules: SemanticRule[] = COMPANY_RULES.filter(
  (r): r is SemanticRule => r.match.kind === "semantic",
);

/** Cue matching is case-insensitive substring matching, same as the gate does. */
function cuesPresent(rule: SemanticRule, text: string): string[] {
  const lower = text.toLowerCase();
  return rule.match.cues.filter((cue) => lower.includes(cue.toLowerCase()));
}

/**
 * A negated counterpart for every exemplar in the rule set, keyed by the
 * exemplar so that adding an exemplar fails the coverage test below rather than
 * quietly shipping untested. Each one is written the way a careful person
 * actually refuses: this is the population the product must never flag.
 */
const NEGATED: Record<string, string> = {
  // residency-promise
  "we guarantee your data never leaves the US":
    "we cannot guarantee your data never leaves the US",
  "your data stays inside your own region, always":
    "I can't promise your data stays inside your own region",
  "nothing you send us ever goes outside the country":
    "I can't promise that nothing you send us ever goes outside the country",
  // absolute-security-claim
  "it is completely secure, nothing can leak":
    "I would not say it is completely secure",
  "there is no way anyone could ever access it":
    "I wouldn't say there is no way anyone could access it",
  "we can't see your data at all, ever":
    "I would not claim we can't see your data at all",
  // performance-guarantee
  "you will definitely see ten times faster queries":
    "I can't say you will definitely see ten times faster queries",
  "guaranteed under a millisecond every time":
    "we do not guarantee under a millisecond every time",
  "it will cut your costs in half, guaranteed":
    "I would not guarantee it will cut your costs in half",
  // delivery-date-commitment
  "that will be ready by the end of next month":
    "that will not be ready by the end of next month",
  "we will have that shipped before you renew":
    "we can't say we will have that shipped before you renew",
  "it is coming in the next release, definitely":
    "I would rather not promise it is coming in the next release",
  // pricing-commitment
  "I can get you thirty percent off": "I can't get you thirty percent off",
  "we will match whatever price you have been quoted":
    "we cannot match whatever price you have been quoted",
  "I will waive that fee for you": "I am unable to waive that fee for you",
  // moving-off-record
  "let's continue this on my personal phone":
    "we can't continue this on my personal phone",
  "text me instead, easier that way":
    "please don't text me, use this thread instead",
  "we can keep this part off the record":
    "we can't keep this part off the record",
  // harsh-criticism
  "this is a stupid way to do it":
    "I would not say this is a stupid way to do it",
  "whoever wrote this clearly had no idea what they were doing":
    "I would not say whoever wrote this had no idea what they were doing",
  "did you even read what I sent, honestly":
    "I don't mean did you even read what I sent",
  "your data is completely inaccessible, not even we can read it":
    "I would not say your data is completely inaccessible",
};

/**
 * Two exemplars used to contain none of their own rule's cues, so under the
 * conjunction they could never fire at any threshold: R1's "nothing you send us
 * ever goes outside the country" and R2's "we can't see your data at all, ever".
 * The cue lists were widened rather than the exemplars reworded.
 *
 * This file previously pinned that as a known-bad list, which meant fixing the
 * data broke the test. Pinning a defect records it; asserting the invariant
 * prevents it. The invariant now lives here and in policies.test.ts.
 */

describe("the rule set is fully covered", () => {
  it("has a negated counterpart for every exemplar", () => {
    const missing = semanticRules.flatMap((r) =>
      r.match.exemplars.filter((e) => !(e in NEGATED)),
    );
    expect(missing).toEqual([]);
  });

  it("has no cue-less exemplar", () => {
    const cueless = semanticRules.flatMap((r) =>
      r.match.exemplars.filter((e) => cuesPresent(r, e).length === 0),
    );
    expect(cueless).toEqual([]);
  });
});

describe("affirmative exemplars are not negated", () => {
  for (const rule of semanticRules) {
    for (const exemplar of rule.match.exemplars) {
      it(`${rule.id}: ${exemplar}`, () => {
        for (const cue of cuesPresent(rule, exemplar)) {
          expect(isNegated(exemplar, cue), `cue "${cue}"`).toBe(false);
        }
      });
    }
  }
});

describe("negated exemplars are suppressed on every cue of their rule", () => {
  for (const rule of semanticRules) {
    for (const exemplar of rule.match.exemplars) {
      const negated = NEGATED[exemplar];
      it(`${rule.id}: ${negated}`, () => {
        for (const cue of rule.match.cues) {
          expect(isNegated(negated, cue), `cue "${cue}"`).toBe(true);
        }
      });
    }
  }
});

/**
 * The permanent regression pair. `never` is the negator in the first sentence and
 * part of the promise in the second, and position relative to the cue is the only
 * thing that tells them apart.
 */
describe("the never pair", () => {
  it("treats never as a negator when it precedes the cue", () => {
    expect(isNegated("we never guarantee that", "guarantee")).toBe(true);
  });

  it("treats never as part of the promise when it is inside the cue", () => {
    expect(isNegated("your data never leaves the US", "never leaves")).toBe(false);
  });

  it("suppresses when the cue is itself a whole negator", () => {
    // `never` is a cue of the security rule as well as a negator. Position
    // cannot separate the two here, because they are the same tokens, so the
    // ambiguity resolves towards silence rather than firing on a refusal.
    expect(isNegated("I would never claim it is completely secure", "never")).toBe(true);
    expect(isNegated("I will never promise that", "never")).toBe(true);
    // And on the other cues of the same sentence the negator still governs.
    expect(isNegated("I would never claim it is completely secure", "completely")).toBe(true);
  });

  it("does not let a negator inside a cue cancel that cue", () => {
    // `cannot be` is a cue of the security rule and contains a negator.
    expect(isNegated("it cannot be accessed by anyone", "cannot be")).toBe(false);
  });
});

describe("the measured refusals that inverted the score", () => {
  const cases: Array<[string, string]> = [
    ["we cannot guarantee your data never leaves the US", "guarantee"],
    ["we cannot guarantee your data never leaves the US", "never leaves"],
    ["I can't promise your data stays inside the US", "stays inside"],
    ["we do not guarantee ten times faster queries", "guarantee"],
    ["I would not say it is completely secure", "completely"],
    ["I can't move this to my personal phone, sorry", "personal phone"],
  ];
  for (const [text, cue] of cases) {
    it(`${text} · ${cue}`, () => {
      expect(isNegated(text, cue)).toBe(true);
    });
  }
});

describe("the demo sentence still fires", () => {
  it("on its own", () => {
    expect(
      isNegated("Yes, we guarantee your data never leaves the US.", "guarantee"),
    ).toBe(false);
  });

  it("inside a compound sentence with a benign trailing clause", () => {
    const draft =
      "Yes, we guarantee your data never leaves the US, and I'll send over the report tomorrow";
    expect(isNegated(draft, "guarantee")).toBe(false);
  });
});

describe("scope", () => {
  it("does not carry a negator across a sentence boundary", () => {
    const draft = "I can't promise anything. We guarantee your data never leaves the US";
    expect(isNegated(draft, "guarantee")).toBe(false);
  });

  it("does not carry a negator across a clause boundary", () => {
    const draft = "I can't promise anything, but we guarantee your data never leaves the US";
    expect(isNegated(draft, "guarantee")).toBe(false);
  });

  it("does not govern a cue beyond the token window", () => {
    // Thirteen tokens of distance inside one clause: unrelated, so it fires.
    const draft =
      "I am not the person you should ask about any of this whatsoever and honestly we guarantee it";
    expect(isNegated(draft, "guarantee")).toBe(false);
  });

  it("suppresses a loosely related negator inside the window", () => {
    // An over-suppression, and the intended direction of error: a missed card is
    // invisible, a card contradicting an explicit refusal is not.
    expect(isNegated("I am not sure we guarantee that", "guarantee")).toBe(true);
  });

  it("suppresses when only one of two occurrences is governed", () => {
    const draft = "we guarantee it and we do not guarantee it";
    expect(isNegated(draft, "guarantee")).toBe(true);
  });
});

describe("every listed negator governs a following cue", () => {
  for (const negator of NEGATORS) {
    it(negator, () => {
      const text =
        negator === "n't"
          ? "honestly we can't guarantee that"
          : `honestly we ${negator} guarantee that`;
      expect(isNegated(text, "guarantee")).toBe(true);
    });
  }

  it("covers contractions the list does not enumerate", () => {
    expect(isNegated("that isn't a guarantee of anything", "guarantee")).toBe(true);
    expect(isNegated("we shouldn't guarantee that", "guarantee")).toBe(true);
  });

  it("uses a window wide enough for the measured cases", () => {
    expect(NEGATOR_WINDOW_TOKENS).toBeGreaterThanOrEqual(6);
  });
});

/**
 * Every cue in the shipped rule set that is exactly a negator must suppress, or
 * the negator gate has a hole a refusal walks straight through. This walks the
 * rule data so a cue added later cannot open one.
 */
describe("no shipped cue is a bare negator that fires on a refusal", () => {
  const bareNegatorCues = semanticRules.flatMap((r) =>
    r.match.cues.filter((c) => NEGATORS.includes(c.toLowerCase())),
  );
  /**
   * The shipped rule set should now contain none of these. R2 previously used
   * "never" and "cannot be" as cues, which the gate suppresses unconditionally,
   * so both were dead: the rule could not fire on them at any threshold. They
   * were replaced with phrases that survive the gate.
   *
   * The behavioural guarantee below still matters, because a rule added later
   * could reintroduce one. So assert the data is clean AND that the gate would
   * hold if it were not.
   */
  it("the shipped rule set has none", () => {
    expect(bareNegatorCues).toEqual([]);
  });

  for (const cue of new Set([...bareNegatorCues, "never", "cannot"])) {
    it(`would suppress "${cue}" if a rule ever used it as a cue`, () => {
      expect(isNegated(`honestly we ${cue} do that sort of thing`, cue)).toBe(true);
    });
  }
});

describe("normalisation", () => {
  it("sees a cue through markup", () => {
    expect(isNegated("we do not **guarantee** it", "guarantee")).toBe(true);
    expect(isNegated("we **guarantee** it always", "guarantee")).toBe(false);
  });

  it("does not read a negator out of an excised code span", () => {
    expect(isNegated("`we do not guarantee` we guarantee it", "guarantee")).toBe(false);
  });

  it("matches a cue regardless of case", () => {
    expect(isNegated("We Cannot Guarantee That", "guarantee")).toBe(true);
  });
});

describe("nothing to say means stay quiet", () => {
  it("suppresses when the cue is absent", () => {
    expect(isNegated("hello there, hope the week is going well", "guarantee")).toBe(true);
  });

  it("suppresses an empty cue", () => {
    expect(isNegated("we guarantee it", "")).toBe(true);
  });

  it("suppresses on empty and whitespace-only text", () => {
    expect(isNegated("", "guarantee")).toBe(true);
    expect(isNegated("   \n  ", "guarantee")).toBe(true);
  });
});

/**
 * The same scope check has to serve the deterministic rung's off-record phrases,
 * which fire with no model involved at all.
 */
describe("the deterministic off-record phrases", () => {
  it("suppresses a refusal to move channel", () => {
    expect(isNegated("I can't move this to my personal phone, sorry", "my personal phone")).toBe(
      true,
    );
  });

  it("still fires on the offer", () => {
    expect(isNegated("let's move this to my personal phone", "my personal phone")).toBe(false);
  });
});
