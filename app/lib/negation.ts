/**
 * Negator scoping. One list, shared by every semantic rule and by the
 * deterministic rung's off-record phrases.
 *
 * Why this file exists at all: measured on the shipped model, the negated form
 * of a sentence outscores the affirmative form on every rule. `we cannot
 * guarantee your data never leaves the US` scores 0.978 against the residency
 * exemplars while `we guarantee your data never leaves the US` scores 0.964, and
 * `I can't move this to my personal phone, sorry` scores 0.535 against the
 * off-record exemplars, above the genuine positive `let's take this to my
 * personal number`. Mean-pooled embeddings encode topic and vocabulary rather
 * than stance. So the embedding is the recall rung and this is the rung that
 * makes the result mean anything.
 *
 * **Ambiguous means suppress, and it never means downgrade.** A missed detection
 * is invisible. A card telling someone they over-promised when they explicitly
 * refused to promise is the single most damaging output this product can
 * produce, and it lands on exactly the careful writer the product claims to
 * help. Every judgement call below therefore resolves towards silence: an absent
 * cue suppresses, a cue with one governed occurrence suppresses even if another
 * occurrence is ungoverned, and the token window is generous rather than tight.
 *
 * Clause boundaries come from `segment.ts`, which owns the single definition of
 * "same clause". Asking the same question of the same function is what keeps
 * this file and segmentation from drifting into two different answers.
 */

import { clauseSpans, embeddingText } from "./segment";

/**
 * Negators and hedges, one list rather than one per rule.
 *
 * `n't` is a suffix rather than a word and is handled by a rule of its own
 * below, which is what covers `isn't`, `aren't`, and `shouldn't` without
 * enumerating English. Several entries are subsumed by shorter ones: `not in a
 * position to` and `rather not` both contain `not`, and `couldn't` is reached by
 * the suffix rule. They stay in the list because the list is the specification
 * and a reader should be able to check it against T2.1.6b.1 line by line.
 *
 * `no` on its own is deliberately absent. `no way` is a cue of the security rule
 * and `no idea` a cue of the tone rule, so a bare `no` would suppress two rules
 * wholesale.
 */
export const NEGATORS: readonly string[] = [
  "not",
  "n't",
  "cannot",
  "can't",
  "won't",
  "never",
  "unable to",
  "wouldn't",
  "couldn't",
  "don't",
  "doesn't",
  "didn't",
  "no longer",
  "rather not",
  "hesitant to",
  "not in a position to",
  "unwilling to",
  "avoid",
  "refrain from",
];

/**
 * How far after a negator a cue can sit and still be governed by it, counted in
 * tokens between the negator's last token and the cue's first.
 *
 * The clause is the primary scope; this window is the backstop for a long clause
 * that opens with an unrelated negator. Eight is roughly a subordinate clause
 * wide, chosen wide on purpose: the measured cases need five or six
 * (`I can't move this to my personal phone` is five), and erring wide costs a
 * missed detection while erring narrow costs a false positive on a refusal.
 */
export const NEGATOR_WINDOW_TOKENS = 8;

/** Words, with apostrophes kept inside them so `can't` stays one token. */
const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

/** The contraction suffix, in both the typed and the typographic apostrophe. */
const NT_SUFFIX = /n['’]t$/;

type Token = { text: string; start: number; end: number };

/** Negators as token sequences, so `unable to` is matched as two tokens. */
const NEGATOR_TOKENS: readonly string[][] = NEGATORS.filter(
  (n) => !NT_SUFFIX.test(n),
).map((n) => Array.from(normalise(n).matchAll(TOKEN), (m) => m[0]));

/**
 * The string cue matching runs against: excisions blanked, markup and emoji
 * stripped, whitespace collapsed, lowercased. Markup matters here rather than
 * being cosmetic, because `we do not **guarantee** it` has to match the cue
 * `guarantee` or the negator gate never gets a chance to run.
 */
function normalise(text: string): string {
  return embeddingText(text).toLowerCase();
}

function tokenize(text: string): Token[] {
  return Array.from(text.matchAll(TOKEN), (m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
}

function isContraction(token: string): boolean {
  return NT_SUFFIX.test(token);
}

/** Does a negator token sequence start at `i`? Returns its length, or 0. */
function negatorLengthAt(tokens: Token[], i: number): number {
  if (isContraction(tokens[i].text)) return 1;
  for (const phrase of NEGATOR_TOKENS) {
    if (phrase.length === 0 || i + phrase.length > tokens.length) continue;
    let ok = true;
    for (let k = 0; k < phrase.length; k++) {
      if (tokens[i + k].text !== phrase[k]) {
        ok = false;
        break;
      }
    }
    if (ok) return phrase.length;
  }
  return 0;
}

/**
 * Is the cue occupying tokens `[cueStart, cueEnd]` governed by a negator?
 *
 * Only tokens strictly before the cue are considered, and that single rule is
 * what resolves the `never` problem: `never` negates the cue in `we never
 * guarantee that`, where it sits before `guarantee`, and is part of the promise
 * in `your data never leaves the US`, where it is inside the cue `never leaves`
 * itself. The same rule keeps `cannot` from cancelling the security rule's own
 * cue `cannot be`. A negator that overlaps the cue is cue text, not a governor.
 */
function isGoverned(tokens: Token[], cueStart: number): boolean {
  for (let i = 0; i < cueStart; i++) {
    const len = negatorLengthAt(tokens, i);
    if (len === 0) continue;
    const lastToken = i + len - 1;
    if (lastToken >= cueStart) continue;
    if (cueStart - (lastToken + 1) <= NEGATOR_WINDOW_TOKENS) return true;
  }
  return false;
}

/** Index of the first token the cue's character span touches, or -1. */
function firstTokenIn(tokens: Token[], start: number, end: number): number {
  return tokens.findIndex((t) => t.end > start && t.start < end);
}

/**
 * Is `cue` present in `segmentText` but governed by a negator, so that no
 * finding should be emitted?
 *
 * Returns true in three cases, all of which mean "stay quiet": the cue is
 * governed somewhere in the segment, the cue is not in the segment at all, or
 * the cue is empty. It returns false only when the cue really is present and no
 * occurrence of it is governed, which is the one case that licenses a finding.
 *
 * The absent-cue case returning true is deliberate rather than a convenience for
 * callers. Mechanically negating an exemplar often removes the cue outright:
 * `that will be ready by the end of next month` becomes `that will not be ready
 * by the end of next month`, and the cue `will be ready` no longer occurs as a
 * substring. Suppression and absence lead to the same place, so they answer the
 * same way.
 */
export function isNegated(segmentText: string, cue: string): boolean {
  const needle = normalise(cue);
  if (needle.length === 0) return true;

  // A cue that is ITSELF a whole negator can never license a finding, so it
  // suppresses unconditionally. `never` is a cue of the security rule as well as
  // a negator, and the position rule below cannot help here: the negator and the
  // cue are the same tokens, so `I would never claim it is completely secure`
  // would report an ungoverned cue and fire on an explicit refusal, which is
  // precisely the failure this file exists to close. This is narrower than it
  // looks: it applies only when the cue is exactly a negator, so the residency
  // rule's `never leaves` and the security rule's own `cannot be` still fire.
  const cueTokens = tokenize(needle);
  if (
    cueTokens.length > 0 &&
    negatorLengthAt(cueTokens, 0) === cueTokens.length
  ) {
    return true;
  }

  // Clause spans come from segmentation so that "same clause" has exactly one
  // definition in this project. A caller normally passes a single clause
  // already; splitting again is cheap and makes the function correct on a whole
  // sentence too, which the deterministic rung passes it.
  const clauses = clauseSpans(segmentText);
  const texts =
    clauses.length > 0 ? clauses.map((c) => c.text) : [segmentText];

  let sawUngoverned = false;
  for (const clauseText of texts) {
    const hay = normalise(clauseText);
    if (!hay.includes(needle)) continue;
    const tokens = tokenize(hay);
    for (let at = hay.indexOf(needle); at !== -1; at = hay.indexOf(needle, at + 1)) {
      const cueStart = firstTokenIn(tokens, at, at + needle.length);
      // A cue made only of punctuation has no tokens to anchor to. Nothing can
      // be shown to be ungoverned, so it stays suppressed.
      if (cueStart === -1) return true;
      if (isGoverned(tokens, cueStart)) return true;
      sawUngoverned = true;
    }
  }
  return !sawUngoverned;
}
