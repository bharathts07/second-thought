/**
 * Tests for the deterministic rung.
 *
 * The acceptance criteria of T2.2 are all here, and three of them exist because
 * an adversarial review of the plan measured the failure first: a term rule that
 * throws on ordinary input and stops every later scan (F16), a whole-word
 * boundary that silently matches inside a longer word, and an offset that
 * disagrees with the text it claims to address.
 *
 * The invariant `text.slice(start, end) === matchedText` is asserted on every
 * finding in every case rather than in one dedicated test, because it is the
 * property the composer's accept path depends on and the one most likely to be
 * broken by an unrelated change.
 */

import { describe, expect, it, vi } from "vitest";
import type { Finding, PolicyRule } from "@/app/lib/types";
import {
  BUILT_IN_CHECK_IDS,
  MAX_FINDINGS_PER_RULE,
  MAX_TERM_LENGTH,
  OFF_RECORD_RULE_ID,
  matchTerms,
  passesLuhn,
  scanBuiltInPatterns,
  scanDeterministic,
  scanOffRecordPhrases,
  scanTermRules,
} from "./deterministic";

/** Every finding must address the text it says it addresses. */
function expectOffsetsAgree(text: string, findings: Finding[]): void {
  for (const finding of findings) {
    expect(text.slice(finding.start, finding.end)).toBe(finding.matchedText);
    expect(finding.end).toBeGreaterThan(finding.start);
    expect(finding.source).toBe("pattern");
    expect(finding.score).toBeUndefined();
  }
}

function scanText(text: string, rules: PolicyRule[] = []): Finding[] {
  const findings = scanDeterministic(text, rules);
  expectOffsetsAgree(text, findings);
  return findings;
}

function ids(findings: Finding[]): string[] {
  return findings.map((f) => f.ruleId);
}

const offRecordRule: PolicyRule = {
  id: OFF_RECORD_RULE_ID,
  source: "company",
  enabled: true,
  title: "Moving the conversation somewhere it is not recorded",
  category: "channel",
  severity: "high",
  appliesTo: ["external-guest", "external-domain"],
  match: {
    kind: "semantic",
    cues: ["personal phone", "text me", "off the record"],
    exemplars: ["let's continue this on my personal phone"],
    threshold: 0.6,
  },
  why: "Business conversations are usually expected to stay on systems the company keeps records on.",
  replacement: "Happy to keep going here so everything stays in one place.",
};

function termRule(terms: string[], wholeWord = true, overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: "strong-language",
    source: "company",
    enabled: true,
    title: "Strong language",
    category: "language",
    severity: "low",
    appliesTo: ["internal", "external-guest", "external-domain"],
    match: { kind: "terms", terms, wholeWord },
    why: "Fine in some rooms and not in others, and this thread may be read by people who are not in the room.",
    ...overrides,
  };
}

describe("secrets patterns (T2.2.1)", () => {
  it("flags a key with the sk- prefix, with no model and no rule set", () => {
    const text = "here you go: sk-abcdefghij0123456789ABCDEFGH let me know";
    const findings = scanText(text);
    expect(ids(findings)).toEqual(["secret-api-key"]);
    expect(findings[0]?.severity).toBe("high");
    expect(findings[0]?.matchedText).toBe("sk-abcdefghij0123456789ABCDEFGH");
    expect(findings[0]?.replacement).toBeUndefined();
  });

  it("flags access tokens, cloud keys, private keys, and signed tokens", () => {
    const cases: Array<[string, string]> = [
      ["ghp_ABCDEFGHIJ0123456789abcdefghij012345", "secret-access-token"],
      ["AKIAIOSFODNN7EXAMPLE", "secret-cloud-key"],
      ["-----BEGIN RSA PRIVATE KEY-----", "secret-private-key"],
      [
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r",
        "secret-signed-token",
      ],
    ];
    for (const [sample, expected] of cases) {
      const text = `paste: ${sample} thanks`;
      expect(ids(scanText(text))).toContain(expected);
    }
  });

  it("does not flag ordinary prose that happens to contain the prefixes", () => {
    const text =
      "This task-oriented approach works, and sk-12 is too short to be anything. AKIAshort too.";
    expect(scanText(text)).toEqual([]);
  });

  it("does not flag a key shape glued to the end of a word", () => {
    // The prefix check is not enough on its own: `task-` ends in `sk-`, so without
    // a left boundary an ordinary hyphenated word followed by an identifier reads
    // as a key.
    expect(scanText("the task-abcdefghij0123456789ABCDEFGH branch")).toEqual([]);
    expect(scanText("xghp_ABCDEFGHIJ0123456789abcdefghij012345")).toEqual([]);
  });

  it("emits only ids this rung declares", () => {
    const findings = scanText("key sk-abcdefghij0123456789ABCDEFGH");
    for (const finding of findings) {
      expect(BUILT_IN_CHECK_IDS).toContain(finding.ruleId);
    }
  });
});

describe("personal-data shapes (T2.2.2)", () => {
  it("flags a card number that passes Luhn", () => {
    const findings = scanText("card is 4111 1111 1111 1111 if you need it");
    expect(ids(findings)).toEqual(["personal-data-card"]);
    expect(findings[0]?.matchedText).toBe("4111 1111 1111 1111");
  });

  it("does NOT flag a 16-digit number that fails Luhn", () => {
    expect(scanText("order reference 1234567890123456 was shipped")).toEqual([]);
  });

  it("checks Luhn directly, since it is what keeps this check quiet", () => {
    expect(passesLuhn("4111111111111111")).toBe(true);
    expect(passesLuhn("1234567890123456")).toBe(false);
    expect(passesLuhn("")).toBe(false);
    expect(passesLuhn("41111111111111a1")).toBe(false);
  });

  it("flags a separated phone number but not a bare ten-digit run", () => {
    expect(ids(scanText("call me on 415-555-0132"))).toEqual(["personal-data-phone"]);
    expect(ids(scanText("call me on (415) 555-0132"))).toEqual(["personal-data-phone"]);
    expect(scanText("the identifier is 4155550132")).toEqual([]);
  });

  it("flags a dashed identifier but not an unallocated range", () => {
    expect(ids(scanText("ssn 123-45-6789 on the form"))).toEqual(["personal-data-ssn"]);
    expect(scanText("ticket 000-45-6789 and 900-45-6789 and 123-00-6789")).toEqual([]);
  });

  it("does not read a slice of a longer number as a phone number or an identifier", () => {
    // `192.168.100.1234` contains `168.100.1234`, which is the exact shape of a
    // dotted phone number, and a digit-only boundary check accepts it because the
    // neighbour is a dot. A false positive on an address in a log is the kind of
    // noise that teaches someone to stop reading this rung.
    expect(scanText("host 192.168.100.1234 is up")).toEqual([]);
    expect(scanText("build 1.234.567.8901 shipped")).toEqual([]);
    expect(scanText("ticket 123-45-6789-0 was closed")).toEqual([]);
    // And the fix must not cost the real thing: a count before a number, or a
    // sentence ending immediately after one, still flags.
    expect(ids(scanText("ext 12 415-555-0132"))).toEqual(["personal-data-phone"]);
    expect(ids(scanText("reach me on 415.555.0132."))).toEqual(["personal-data-phone"]);
  });

  it("flags an email address", () => {
    const findings = scanText("write to sam@example.com about it");
    expect(ids(findings)).toEqual(["personal-data-email"]);
    expect(findings[0]?.matchedText).toBe("sam@example.com");
    expect(findings[0]?.severity).toBe("low");
  });

  it("gives one card per span when two shapes claim the same digits", () => {
    const findings = scanText("4111 1111 1111 1111");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.ruleId).toBe("personal-data-card");
  });

  it("caps findings per check so a pasted log is guidance rather than a wall", () => {
    const text = Array.from({ length: 40 }, (_, i) => `sam${i}@example.com`).join(" ");
    const findings = scanText(text);
    expect(findings).toHaveLength(MAX_FINDINGS_PER_RULE);
  });
});

describe("matchTerms, literal substrings only (T2.2.6, F16)", () => {
  it("matches regex metacharacters literally and does not throw", () => {
    const terms = ["f**k", "c++", "(sic)", "$$$", "[wip]", "a?b"];
    const text = "this f**k of a c++ build (sic) costs $$$ and [wip] and a?b";
    let matches: ReturnType<typeof matchTerms> = [];
    expect(() => {
      matches = matchTerms(text, terms, true);
    }).not.toThrow();
    expect(matches.map((m) => m.term).sort()).toEqual([
      "$$$",
      "(sic)",
      "[wip]",
      "a?b",
      "c++",
      "f**k",
    ]);
    for (const match of matches) {
      expect(text.slice(match.start, match.end)).toBe(match.text);
    }
  });

  it("does not treat a star as a wildcard, so a near-miss term simply does not fire", () => {
    // The quiet half of F16: `f*ck` compiled as a pattern would match `fck` and
    // the author would never learn why their rule seemed dead.
    expect(matchTerms("say fck to that", ["f*ck"], true)).toEqual([]);
    expect(matchTerms("say f*ck to that", ["f*ck"], true)).toHaveLength(1);
  });

  it("keeps a hostile term from ending the scan for every other rule", () => {
    const onRuleError = vi.fn();
    const rules = [termRule(["c++"], true, { id: "personal:metachars" }), termRule(["damn"])];
    const text = "the c++ rewrite is a damn mess";
    const findings = scanTermRules(text, rules, { onRuleError });
    expect(ids(findings).sort()).toEqual(["personal:metachars", "strong-language"]);
    expect(onRuleError).not.toHaveBeenCalled();
  });

  it("is case-insensitive over NFC-normalised text, with offsets into the original", () => {
    expect(matchTerms("Damn this", ["damn"], true)).toHaveLength(1);
    expect(matchTerms("damn this", ["DAMN"], true)).toHaveLength(1);

    // Written as escapes rather than as accented literals so the two normal
    // forms stay visible in the source. NFC folds the decomposed pair into one
    // character, so the folded string is shorter than the draft and an offset
    // taken from it would highlight the wrong characters in the composer.
    const composed = "caf\u00e9";
    const decomposed = "cafe\u0301";
    const draft = `one ${decomposed} later`;
    const matches = matchTerms(draft, [composed], true);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.text).toBe(decomposed);
    expect(draft.slice(matches[0]?.start ?? 0, matches[0]?.end ?? 0)).toBe(decomposed);

    // And the other way round: composed draft, decomposed term.
    expect(matchTerms(`one ${composed} later`, [decomposed], true)).toHaveLength(1);
  });

  it("skips empty, whitespace-only, and over-long terms rather than firing on them", () => {
    expect(matchTerms("anything at all", ["", "   ", "\t"], true)).toEqual([]);
    const tooLong = "a".repeat(MAX_TERM_LENGTH + 1);
    expect(matchTerms(tooLong, [tooLong], false)).toEqual([]);
  });

  it("returns one match per span when two terms overlap, longest first", () => {
    const matches = matchTerms("use my personal phone instead", [
      "personal",
      "my personal phone",
    ], true);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.text).toBe("my personal phone");
  });

  it("stays linear on a pasted log, since it runs on every keystroke", () => {
    // Overlap resolution that scans the matches it has already kept is quadratic,
    // and a one-character term against 40k characters is 1.6 billion comparisons
    // per debounce. The count is the assertion; the timeout is the point.
    const text = "a".repeat(40_000);
    const started = Date.now();
    expect(matchTerms(text, ["a"], false)).toHaveLength(40_000);
    expect(Date.now() - started).toBeLessThan(1_000);
  }, 5_000);

  it("finds every occurrence, in reading order", () => {
    const matches = matchTerms("damn, and damn again", ["damn"], true);
    expect(matches.map((m) => m.start)).toEqual([0, 10]);
  });
});

describe("wholeWord, defined explicitly rather than via \\b (T2.2.6)", () => {
  it("does not match inside a longer word", () => {
    expect(matchTerms("goddamn it", ["damn"], true)).toEqual([]);
    expect(matchTerms("damnation", ["damn"], true)).toEqual([]);
    expect(matchTerms("damn, honestly", ["damn"], true)).toHaveLength(1);
  });

  it("treats an apostrophe as part of the word, which is where \\b fails", () => {
    expect(matchTerms("don't do that", ["don"], true)).toEqual([]);
    expect(matchTerms("don\u2019t do that", ["don"], true)).toEqual([]);
    expect(matchTerms("don't do that", ["don't"], true)).toHaveLength(1);
  });

  it("treats a non-ASCII letter as part of the word, the other place \\b fails", () => {
    expect(matchTerms("one caf\u00e9 later", ["caf"], true)).toEqual([]);
    expect(matchTerms("\u00fcber damn", ["damn"], true)).toHaveLength(1);
  });

  it("still matches a term made of punctuation, which no boundary could bracket", () => {
    expect(matchTerms("costs$$$today", ["$$$"], true)).toHaveLength(1);
  });

  it("matches inside a word when wholeWord is false", () => {
    expect(matchTerms("goddamn it", ["damn"], false)).toHaveLength(1);
  });
});

describe("off-record phrases (T2.2.3)", () => {
  it("flags each phrase, taking its copy from the rule", () => {
    for (const phrase of [
      "text me",
      "my cell",
      "my personal phone",
      "personal email",
      "off the record",
      "outside of here",
    ]) {
      const text = `honestly, ${phrase} is easier`;
      const findings = scanText(text, [offRecordRule]);
      expect(ids(findings)).toEqual([OFF_RECORD_RULE_ID]);
      expect(findings[0]?.title).toBe(offRecordRule.title);
      expect(findings[0]?.severity).toBe("high");
      expect(findings[0]?.replacement).toBe(offRecordRule.replacement);
    }
  });

  it("names no messaging app anywhere in the phrase list or the copy", () => {
    // content-safety §6. The recordkeeping point does not depend on which app it
    // is, so a test rather than a convention keeps a helpful addition out.
    const surface = JSON.stringify(scanDeterministic("text me", [offRecordRule]));
    for (const named of ["whatsapp", "signal", "telegram", "slack", "teams", "imessage"]) {
      expect(surface.toLowerCase()).not.toContain(named);
    }
  });

  it("stays silent when the rule is not in the effective set, so the gate governs it", () => {
    // `moving-off-record` is external-only, so an internal recipient filters the
    // rule out upstream and the phrases must go quiet with it.
    expect(scanText("text me instead, easier that way", [])).toEqual([]);
    expect(scanText("text me instead", [{ ...offRecordRule, enabled: false }])).toEqual([]);
  });

  it("suppresses a phrase a negator governs, rather than downgrading it", () => {
    // T2.1.6b.3 and T2.1.6b.4: a card telling someone they moved a conversation
    // off the record when they refused to is the most damaging output here.
    const text = "I can't move this to my personal phone, sorry";
    const isNegated = vi.fn(() => true);
    expect(scanOffRecordPhrases(text, [offRecordRule], { isNegated })).toEqual([]);
    expect(isNegated).toHaveBeenCalledWith(text, "my personal phone");
    expect(scanOffRecordPhrases(text, [offRecordRule])).toHaveLength(1);
  });

  it("leaves the phrases to the term path if the rule is authored as terms", () => {
    const asTerms = termRule(["off the record"], true, { id: OFF_RECORD_RULE_ID });
    const findings = scanText("keep this off the record please", [asTerms]);
    expect(findings).toHaveLength(1);
  });
});

describe("one rule failing costs that rule only (T2.2.7)", () => {
  /** A rule whose terms cannot be read. Nothing in the type system forbids it. */
  function hostileRule(): PolicyRule {
    return {
      ...termRule(["ignored"]),
      id: "personal:hostile",
      match: {
        kind: "terms",
        wholeWord: true,
        get terms(): string[] {
          throw new Error("this rule is malformed");
        },
      },
    } as unknown as PolicyRule;
  }

  it("reports the failure and keeps scanning the other rules", () => {
    const onRuleError = vi.fn();
    const text = "this damn build again, sam@example.com";
    const findings = scanDeterministic(text, [hostileRule(), termRule(["damn"])], {
      onRuleError,
    });
    expectOffsetsAgree(text, findings);
    expect(ids(findings)).toEqual(["strong-language", "personal-data-email"]);
    expect(onRuleError).toHaveBeenCalledTimes(1);
    expect(onRuleError.mock.calls[0]?.[0]).toBe("personal:hostile");
  });

  it("never throws, whatever the rule set contains", () => {
    const nonsense = [
      hostileRule(),
      { ...termRule([]), id: "personal:empty" },
      { id: "personal:shapeless" } as unknown as PolicyRule,
    ];
    expect(() => scanDeterministic("anything at all", nonsense)).not.toThrow();
  });

  it("survives a rule set that is not a list, and says so", () => {
    // An imported file or a stale stored value can be an object where an array was
    // expected, and iterating it throws from outside every per-rule try/catch.
    const onRuleError = vi.fn();
    const notAList = { "moving-off-record": offRecordRule } as unknown as PolicyRule[];
    let findings: Finding[] = [];
    expect(() => {
      findings = scanDeterministic("text me on 415-555-0132", notAList, { onRuleError });
    }).not.toThrow();
    // The built-in checks need no rule set, so they must still report.
    expect(ids(findings)).toEqual(["personal-data-phone"]);
    expect(onRuleError).toHaveBeenCalled();
  });
});

describe("scanDeterministic, the whole rung", () => {
  it("returns nothing for empty, whitespace, and punctuation-only drafts", () => {
    for (const text of ["", "   \n\t ", "... !?"]) {
      expect(scanText(text, [offRecordRule, termRule(["damn"])])).toEqual([]);
    }
  });

  it("runs with no rule set at all, which is how it works during the download", () => {
    // The rung is synchronous and imports nothing at runtime, so this is the same
    // answer it gives in the page's first second with no encoder present.
    const text = "key sk-abcdefghij0123456789ABCDEFGH";
    expect(ids(scanText(text))).toEqual(["secret-api-key"]);
    expect(scanBuiltInPatterns(text)).toEqual(scanDeterministic(text, []));
  });

  it("returns findings in reading order", () => {
    const text = "text me on 415-555-0132, this damn form wants sam@example.com";
    const findings = scanText(text, [offRecordRule, termRule(["damn"])]);
    expect(ids(findings)).toEqual([
      OFF_RECORD_RULE_ID,
      "personal-data-phone",
      "strong-language",
      "personal-data-email",
    ]);
    const starts = findings.map((f) => f.start);
    expect([...starts]).toEqual([...starts].sort((a, b) => a - b));
  });

  it("carries rule provenance through, so a card can say where a rule came from", () => {
    const personal = termRule(["damn"], true, {
      id: "personal:no-swearing",
      source: "personal",
    });
    const findings = scanText("this damn thing", [personal]);
    expect(findings[0]?.ruleSource).toBe("personal");
    expect(findings[0]?.ruleId).toBe("personal:no-swearing");
  });

  it("can leave the built-in checks out when only rule findings are wanted", () => {
    const findings = scanDeterministic("mail sam@example.com", [], { skipBuiltIns: true });
    expect(findings).toEqual([]);
  });

  it("does not let a built-in pattern share a span with another built-in", () => {
    const text = "card 4111-1111-1111-1111 and phone (415) 555-0132";
    const findings = scanText(text);
    expect(ids(findings)).toEqual(["personal-data-card", "personal-data-phone"]);
  });
});
