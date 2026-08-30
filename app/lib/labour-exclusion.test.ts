import { describe, expect, it } from "vitest";

import { isLabourRelations, LABOUR_TOPICS } from "./labour-exclusion";

/**
 * Zero tone and zero language findings on labour-relations sentences is a hard
 * gate, not a preference, so these cases are asserted at the source of the gate
 * as well as through the fixture sweep. The near-paraphrases of the tone rule's
 * own exemplars are the reason the gate exists: measured, they clear any
 * plausible threshold, so without this module the demo flags protected concerted
 * activity about workload and pay.
 */

describe("the fixtures the tone rule would otherwise flag", () => {
  const cases = [
    "whoever set this on-call schedule clearly had no idea what it takes to do this job",
    "did you even read the pay band you sent me, honestly",
    "the overtime policy is a joke and everyone knows it",
    "we are understaffed and this shift pattern is not sustainable",
    "nobody here can live on that salary, this is ridiculous",
    "the headcount freeze means we are doing three jobs each",
    "this workload is unreasonable and it has been for months",
    "the raise they offered is insulting given what we deliver",
    "if the layoff list is already written they should say so",
    "several of us want to raise a grievance about the schedule",
    "the safety walkthrough was skipped again, which is unsafe",
    "we are organising a meeting about compensation on Thursday",
  ];
  for (const text of cases) {
    it(text, () => {
      expect(isLabourRelations(text)).toBe(true);
    });
  }
});

describe("every listed topic is reachable", () => {
  for (const topic of LABOUR_TOPICS) {
    it(topic, () => {
      expect(isLabourRelations(`honestly the ${topic} situation here is the problem`)).toBe(true);
    });
  }
});

describe("inflections the writer will actually type", () => {
  const cases = [
    "wages here have not moved in two years",
    "the salaries in this band are public now",
    "she raised it with HR last week",
    "the layoffs were announced without warning",
    "people are unionising over this",
    "several grievances were filed",
    "my shifts changed twice this week",
    "the rota was scheduled by someone who has never done it",
    "we are still paid less than the market",
    "the bonuses were cut with no explanation",
    "hours worked past midnight are not being counted",
    "whistleblowers should not have to worry about this",
    "the team is organising over this",
    "a few of us are organizing about it",
  ];
  for (const text of cases) {
    it(text, () => {
      expect(isLabourRelations(text)).toBe(true);
    });
  }
});

describe("forms the gate must not miss", () => {
  const cases = [
    // The T2.7.1e fixture is about an on-call rota, and people type it unhyphenated.
    "whoever set this on call schedule clearly had no idea what it takes",
    "we are unpaid for this work",
    "the team is underpaid compared to the market",
    "hourly staff are the ones carrying this",
  ];
  for (const text of cases) {
    it(text, () => {
      expect(isLabourRelations(text)).toBe(true);
    });
  }
});

/**
 * The list is broad on purpose and its mistakes run one way: matching a sentence
 * that turns out not to be about working conditions costs one tone card nobody
 * sees. These rows record how broad that actually is, so the breadth is a choice
 * on the record rather than a surprise. They are not a wish list to narrow: the
 * cost of a miss is chilling protected speech.
 */
describe("the deliberate over-match, on the record", () => {
  const cases = [
    "the safety of your data is our priority",
    "please pay the invoice by Friday",
    "we can raise the limit for you",
    "our schedule for the demo is set",
  ];
  for (const text of cases) {
    it(text, () => {
      expect(isLabourRelations(text)).toBe(true);
    });
  }
});

describe("ordinary drafts are untouched", () => {
  const cases = [
    "we guarantee your data never leaves the US",
    "this is a stupid way to do it",
    "let's continue this on my personal phone",
    "I do not think this is the right approach",
    "the company roadmap slide needs one more pass",
    "the payload was truncated in the second request",
    "that is a striking way to present the numbers",
    "I can put you in touch with our security team for the specifics",
  ];
  for (const text of cases) {
    it(text, () => {
      expect(isLabourRelations(text)).toBe(false);
    });
  }
});

describe("boundaries", () => {
  it("does not match a topic inside a longer unrelated word", () => {
    // `pay` inside `payload`, `strike` inside `strikethrough`, `hr` inside `href`.
    expect(isLabourRelations("the payload uses strikethrough in the href")).toBe(false);
  });

  it("matches a topic across a hyphen or possessive", () => {
    expect(isLabourRelations("the salary-review cycle slipped again")).toBe(true);
    expect(isLabourRelations("the union's position is clear")).toBe(true);
  });

  it("ignores a topic that only appears inside excised code", () => {
    // Code is masked before matching, so a variable named `overtime` in a snippet
    // does not silence tone checks on the prose around it.
    expect(isLabourRelations("look at `overtime_total` in the query")).toBe(false);
  });

  it("returns false on empty input", () => {
    expect(isLabourRelations("")).toBe(false);
    expect(isLabourRelations("   ")).toBe(false);
  });
});

/**
 * The exclusion is category-scoped by design. This module answers only "is this
 * about pay, hours, or working conditions", and the caller suppresses `tone` and
 * `language` findings alone. A pricing commitment in a sentence that mentions pay
 * still has to reach the person drafting it.
 */
describe("what the caller must not suppress", () => {
  it("matches a commitment sentence that also mentions pay", () => {
    expect(isLabourRelations("I can get you thirty percent off the pay-as-you-go plan")).toBe(true);
  });
});
