import { describe, expect, it } from "vitest";
import { COMPANY_RULES } from "./policies";
import { validateFixtures } from "./fixtures";
import { NEGATORS } from "./negation";

const semantic = COMPANY_RULES.filter((r) => r.match.kind === "semantic");

describe("rule data invariants", () => {
  /**
   * The one that matters most. Under the cue-plus-negator-plus-threshold
   * conjunction, an exemplar containing none of its own rule's cues can never
   * fire at any threshold. It is dead weight that also silently depresses the
   * measured recall floor, so it looks like a tuning problem in the sweep
   * rather than a data problem in the rule.
   *
   * Two exemplars shipped this way before it was caught: R1's "nothing you send
   * us ever goes outside the country" and R2's "we can't see your data at all,
   * ever".
   */
  it("every exemplar contains at least one cue of its own rule", () => {
    const dead: string[] = [];
    for (const rule of semantic) {
      if (rule.match.kind !== "semantic") continue;
      for (const exemplar of rule.match.exemplars) {
        const lower = exemplar.toLowerCase();
        const hit = rule.match.cues.some((c) => lower.includes(c.toLowerCase()));
        if (!hit) dead.push(`${rule.id}: "${exemplar}"`);
      }
    }
    expect(dead).toEqual([]);
  });

  /**
   * A cue that is itself a whole negator is suppressed unconditionally by the
   * negation gate, so it can never contribute. R2 carried two such cues
   * ("never", "cannot be") and they were silently dead.
   */
  it("no cue is itself a whole negator", () => {
    const negatorSet = new Set(NEGATORS.map((n) => n.toLowerCase().trim()));
    const dead: string[] = [];
    for (const rule of semantic) {
      if (rule.match.kind !== "semantic") continue;
      for (const cue of rule.match.cues) {
        if (negatorSet.has(cue.toLowerCase().trim())) {
          dead.push(`${rule.id}: cue "${cue}" is a negator`);
        }
      }
    }
    expect(dead).toEqual([]);
  });

  it("every semantic rule has at least one cue", () => {
    for (const rule of semantic) {
      if (rule.match.kind !== "semantic") continue;
      expect(rule.match.cues.length, rule.id).toBeGreaterThan(0);
    }
  });

  it("rule ids are unique", () => {
    const ids = COMPANY_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tone and language rules apply internally, commitment rules do not", () => {
    for (const rule of COMPANY_RULES) {
      const internal = rule.appliesTo.includes("internal");
      if (rule.category === "tone" || rule.category === "language") {
        expect(internal, `${rule.id} should apply internally`).toBe(true);
      } else {
        expect(internal, `${rule.id} should not apply internally`).toBe(false);
      }
    }
  });
});

describe("the fixture corpus agrees with the rule set", () => {
  /**
   * validateFixtures is only meaningful if something calls it. Nothing did,
   * which is how the demo-critical row's missing cue stayed invisible.
   */
  it("validateFixtures reports no problems", () => {
    expect(validateFixtures(COMPANY_RULES)).toEqual([]);
  });
});
