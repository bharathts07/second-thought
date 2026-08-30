/**
 * Labour-relations exclusion. A hard gate, and a decision rather than a detail.
 *
 * **Why this list is not arbitrary, and must not be pruned.** Section 7 of the
 * US National Labor Relations Act protects employees who act together over pay,
 * hours, and working conditions, and that protection does not depend on the
 * conversation being polite. A drafting aid that puts a card under an internal
 * message about an on-call rota, a pay band, or short staffing is telling an
 * employee that concerted activity reads badly. This product must not be the
 * thing that chills it, and a public demo that does so would be making the
 * argument for the opposite of what the project stands for. Comparable
 * protections exist elsewhere: works-council codetermination over monitoring in
 * Germany, and data-protection expectations around employee monitoring in the UK
 * and EU. None of that is legal advice, and none of it is the point. The point is
 * that the design is deliberate.
 *
 * The topic list is broad on purpose and its mistakes run one way. Matching a
 * sentence that turns out not to be about work conditions costs one tone card
 * nobody sees. Missing one costs the thing above.
 *
 * **What a match suppresses, and what it does not.** A match suppresses every
 * `tone` and `language` finding on that sentence and returns silently: no
 * downgrade, no log, no "suppressed" affordance in the UI, because an affordance
 * saying "we noticed something here and chose not to say it" is its own chilling
 * effect. It does **not** suppress `claim`, `commitment`, `channel`, or
 * `disclosure` findings. An unapproved pricing commitment is still worth
 * catching in a sentence that happens to mention headcount, and a sentence like
 * `I can get you thirty percent off the pay-as-you-go plan` is matched here yet
 * must still flag as a pricing commitment.
 *
 * That category scoping is applied once, in the effective-rule filter that builds
 * the rule set for a scan, rather than inside each rule. A personal tone rule
 * authored later then inherits the exclusion automatically and cannot opt out of
 * it.
 */

import { embeddingText } from "./segment";

/**
 * Topics that mark a sentence as labour relations. Transcribed from T2.1.7.1;
 * both spellings of `organize` are listed because the draft is whatever the
 * writer types.
 */
export const LABOUR_TOPICS: readonly string[] = [
  "pay",
  "wage",
  "salary",
  "compensation",
  "raise",
  "bonus",
  "overtime",
  "hours",
  "schedule",
  "shift",
  "on-call",
  "workload",
  "staffing",
  "understaffed",
  "headcount",
  "layoff",
  "union",
  "organize",
  "organise",
  "walkout",
  "strike",
  "grievance",
  "HR",
  "harassment",
  "discrimination",
  "retaliation",
  "unsafe",
  "safety",
  "whistleblow",
];

/**
 * Inflections a listed topic may carry. `pay` has to reach `paying` and `pays`,
 * `schedule` has to reach `scheduled`, `union` has to reach `unionising`. A stem
 * match with no suffix control would also reach `payload` and `strikethrough`,
 * which is why the tail is constrained rather than open.
 */
const INFLECTIONS = [
  "izing",
  "ising",
  "ized",
  "ised",
  "ings",
  "ize",
  "ise",
  "ing",
  "ers",
  "es",
  "ed",
  "er",
  "ly",
  "s",
  "d",
];

/**
 * Forms the stem rule cannot reach, kept separate so the transcribed list above
 * stays comparable to the plan line by line. `paid` is here because a sentence
 * about being paid is the same conversation as a sentence about pay, and the two
 * bare stems are here because `organising` and `organizing` both drop the final
 * vowel of the listed spelling, which is exactly the form someone types when they
 * are in fact organising.
 */
const IRREGULAR_FORMS = [
  "salaries",
  "paid",
  "paycheck",
  "organis",
  "organiz",
  // `on call` unhyphenated is what people actually type, and the T2.7.1e fixture
  // is about an on-call rota, so the spaced form has to reach the same gate.
  "on call",
  // A prefixed stem fails the left-boundary check, so the words an underpaid or
  // unpaid person uses about being underpaid or unpaid are listed outright.
  "unpaid",
  "underpaid",
  "overpaid",
  // `hourly` is not `hours` plus a listed suffix.
  "hourly",
];

function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One alternation, longest term first so that `understaffed` is not consumed as
 * `staffing`'s stem, with the right-hand boundary inside the pattern as a
 * lookahead. Keeping the boundary in the regex lets it backtrack through the
 * suffix alternatives until one leaves a real word end, so `schedules` matches
 * through `es` rather than stopping at `s` and failing the boundary check.
 * Lookbehind is avoided deliberately: it is unsupported on older mobile browsers
 * that this product otherwise runs on, so the left boundary is checked in code.
 */
const TOPIC_PATTERN = new RegExp(
  `(?:${[...LABOUR_TOPICS, ...IRREGULAR_FORMS]
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})(?:${INFLECTIONS.join("|")})?(?![a-z0-9])`,
  "gi",
);

const WORD_CHAR = /[a-z0-9]/i;

/**
 * Does this text discuss pay, hours, or working conditions?
 *
 * Called per sentence rather than per draft, so that one mention of staffing does
 * not silence tone checks across an unrelated paragraph.
 */
export function isLabourRelations(text: string): boolean {
  // The same normalisation the cue gate uses, so a fenced code block or a URL
  // containing one of these words is not what triggers the exclusion.
  const haystack = embeddingText(text).toLowerCase();
  TOPIC_PATTERN.lastIndex = 0;
  for (const m of haystack.matchAll(TOPIC_PATTERN)) {
    const before = m.index === 0 ? "" : haystack[m.index - 1];
    if (before !== "" && WORD_CHAR.test(before)) continue;
    return true;
  }
  return false;
}
