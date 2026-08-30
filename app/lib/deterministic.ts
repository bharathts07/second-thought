/**
 * The deterministic rung (T2.2). No model, no network, no async.
 *
 * This rung runs before segmentation and before any embedding, which is a
 * product behaviour rather than an optimisation: the page is useful in its first
 * second, while the encoder is still downloading. Everything here is a pure
 * function over the draft string, so it is also the only part of the engine that
 * can be trusted while the rest of the ladder is unavailable.
 *
 * Two invariants hold for every finding this module returns:
 *
 * 1. `text.slice(start, end) === matchedText`, because `matchedText` is always
 *    sliced out of the ORIGINAL draft rather than reconstructed from whatever
 *    normalised form the match was found in. The accept path in E4 locates its
 *    target by text as well as by span (ux-spec §8.1), so a span that disagrees
 *    with its text would rewrite the wrong part of someone's message.
 * 2. One rule throwing costs that rule and nothing else (T2.2.7). Rules can be
 *    user-authored, and `scan()` runs on every debounced keystroke, so a single
 *    bad term must not be able to take down every subsequent scan (F16).
 *
 * Types are imported type-only, so this module has no runtime imports at all.
 */

import type {
  Finding,
  PolicyRule,
  RuleCategory,
  Severity,
} from "@/app/lib/types";

/**
 * A word character, for the whole-word boundary of T2.2.6.
 *
 * `\b` is the obvious tool and it is wrong twice over. It reads an apostrophe as
 * a boundary, so the term `don` matches inside `don't`, and it reads every
 * non-ASCII letter as a boundary, so `caf` matches inside `café`. Both are wrong
 * answers rather than crashes, which is the harder kind to notice, so the
 * boundary is defined explicitly here instead.
 *
 * Constructed from a string rather than written as a literal because the
 * compile target predates Unicode property escapes in regex literals.
 */
const WORD_CHAR = new RegExp("[\\p{L}\\p{N}\\p{M}_'\\u2019]", "u");

/**
 * One starter plus its trailing combining marks. NFC composes within such a
 * cluster and never across two of them, which is what makes the cluster a safe
 * unit to map offsets on: folding can change a cluster's length, but it cannot
 * move a cluster boundary.
 */
const CLUSTER = new RegExp("[\\s\\S]\\p{M}*", "gu");

/** Terms longer than this are ignored rather than matched (T2.2.6). */
export const MAX_TERM_LENGTH = 80;

/**
 * Per-rule cap on findings. A pasted log file can contain hundreds of email
 * addresses, and three hundred cards is not guidance, it is a wall.
 */
export const MAX_FINDINGS_PER_RULE = 20;

/** The rule whose phrases also get deterministic coverage (T2.1.5). */
export const OFF_RECORD_RULE_ID = "moving-off-record";

/**
 * Phrases for `moving-off-record`, belt and braces on the rule a visitor is
 * most likely to try by hand.
 *
 * **No messaging app is named here, deliberately** (content-safety §6). The
 * recordkeeping point does not depend on which app the conversation moves to,
 * and naming one implies something about that app that this project has no
 * business implying. Anything more specific belongs in a user's own rule, in
 * their own browser, never in this repository.
 */
export const OFF_RECORD_PHRASES: readonly string[] = [
  "text me",
  "my cell",
  "my personal phone",
  "personal email",
  "off the record",
  "outside of here",
];

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && ch.length > 0 && WORD_CHAR.test(ch);
}

function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch.length === 1 && ch >= "0" && ch <= "9";
}

/** The whole code point ending at `index`, so a surrogate pair reads as one. */
function charBefore(text: string, index: number): string | undefined {
  if (index <= 0 || index > text.length) return undefined;
  const unit = text.charCodeAt(index - 1);
  if (unit >= 0xdc00 && unit <= 0xdfff && index >= 2) {
    return text.slice(index - 2, index);
  }
  return text.charAt(index - 1);
}

/** The whole code point starting at `index`. */
function charAtIndex(text: string, index: number): string | undefined {
  if (index < 0 || index >= text.length) return undefined;
  const cp = text.codePointAt(index);
  return cp === undefined ? undefined : String.fromCodePoint(cp);
}

/**
 * The draft, case-folded and NFC-normalised, with every folded position mapped
 * back to the original string.
 *
 * Normalising the whole draft and searching in that string is the obvious
 * approach and it quietly breaks offsets: NFC changes length, so an index into
 * the normalised text does not address the same character in the draft the
 * composer is highlighting. Lowercasing does the same thing on a few characters.
 * The map is what keeps offsets pointing at the draft.
 */
type Folded = {
  text: string;
  /** Folded index to the start of its cluster in the original. */
  start: number[];
  /** Folded index to the end of its cluster in the original. */
  end: number[];
};

function fold(text: string): Folded {
  let folded = "";
  const start: number[] = [];
  const end: number[] = [];
  for (const match of text.matchAll(CLUSTER)) {
    const at = match.index;
    if (at === undefined) continue;
    const cluster = match[0];
    const foldedCluster = cluster.normalize("NFC").toLowerCase();
    for (let i = 0; i < foldedCluster.length; i += 1) {
      start.push(at);
      end.push(at + cluster.length);
    }
    folded += foldedCluster;
  }
  return { text: folded, start, end };
}

/**
 * `wholeWord: true`, stated as a rule rather than as a regex: a match must be
 * bounded on each side by a non-word character or by the edge of the string.
 *
 * The boundary is only required on a side where the term's own edge is a word
 * character. Without that condition a term of punctuation such as `$$$` could
 * never match anything, since its neighbours in real prose are letters.
 */
function isBounded(hay: string, start: number, end: number, needle: string): boolean {
  const first = charAtIndex(needle, 0);
  const last = charBefore(needle, needle.length);
  if (isWordChar(first) && isWordChar(charBefore(hay, start))) return false;
  if (isWordChar(last) && isWordChar(charAtIndex(hay, end))) return false;
  return true;
}

export type TermMatch = {
  /** The term as authored, useful for the `Remove it` affordance. */
  term: string;
  start: number;
  end: number;
  /** Sliced from the original text, so the span and the text always agree. */
  text: string;
};

/**
 * Literal, case-insensitive substring matching over NFC-normalised text
 * (T2.2.6). This is finding F16, and the natural guess is the defect: building
 * `new RegExp("\\b" + term + "\\b")` throws `SyntaxError` on `f**k`, `c++`, or
 * `(sic)`, and since this rung runs on every debounced keystroke, one such term
 * in one rule stops every scan for every draft. The quieter variant is worse:
 * `f*ck` compiles, silently matches `fck`, and the rule simply never fires.
 *
 * So terms are never compiled as patterns. `indexOf` is the whole algorithm. If
 * a future change genuinely needs a `RegExp` here, it must be built from an
 * escaped term: `term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`.
 *
 * Empty, whitespace-only, and over-long terms are skipped rather than rejected
 * loudly. They are refused at authoring time (T10.4.5); by the time a draft is
 * being scanned, the useful behaviour is that the rest of the rule still works.
 *
 * Folding happens per call rather than once per scan. A draft is one chat message
 * and this rung is debounced, so a second linear pass per rule costs less than a
 * cache that can disagree with the text it was built from.
 */
export function matchTerms(
  text: string,
  terms: readonly string[],
  wholeWord: boolean,
): TermMatch[] {
  if (text.length === 0 || terms.length === 0) return [];
  const hay = fold(text);
  const found: TermMatch[] = [];

  for (const term of terms) {
    if (typeof term !== "string") continue;
    if (term.trim().length === 0) continue;
    if (term.length > MAX_TERM_LENGTH) continue;
    const needle = term.normalize("NFC").toLowerCase();
    if (needle.length === 0) continue;

    let from = 0;
    for (;;) {
      const at = hay.text.indexOf(needle, from);
      if (at < 0) break;
      const foldedEnd = at + needle.length;
      // Advance by one rather than by the match length: overlapping occurrences
      // are all collected here and resolved once, below.
      from = at + 1;
      if (wholeWord && !isBounded(hay.text, at, foldedEnd, needle)) continue;
      const start = hay.start[at];
      const end = hay.end[foldedEnd - 1];
      if (start === undefined || end === undefined || end <= start) continue;
      found.push({ term, start, end, text: text.slice(start, end) });
    }
  }

  return resolveOverlaps(found);
}

/**
 * One span, one match. Two terms overlapping on the same words would otherwise
 * produce two cards for one phrase, and `my personal phone` should read as one
 * thing rather than as `my cell`-adjacent fragments. Earliest wins, and at the
 * same position the longest wins, because the longer term is the more specific
 * statement of what the author meant.
 */
function resolveOverlaps(matches: TermMatch[]): TermMatch[] {
  const sorted = [...matches].sort(
    (a, b) =>
      a.start - b.start ||
      (b.end - b.start) - (a.end - a.start) ||
      (a.term < b.term ? -1 : a.term > b.term ? 1 : 0),
  );
  const kept: TermMatch[] = [];
  // `sorted` is in non-decreasing `start`, so every kept span begins at or before
  // the candidate and `k.start < match.end` is already true for all of them. The
  // clash therefore reduces to "some kept span has not ended yet", which one
  // running maximum answers. Scanning `kept` instead would be quadratic in the
  // number of matches, and a one-character term against a pasted log produces one
  // match per character on every debounced keystroke.
  let furthestEnd = -1;
  for (const match of sorted) {
    if (match.start < furthestEnd) continue;
    kept.push(match);
    if (match.end > furthestEnd) furthestEnd = match.end;
  }
  return kept;
}

/**
 * The Luhn check digit, which is what separates a card number from any other run
 * of sixteen digits (T2.2.2). Without it an order number, a serial, or a row of
 * ticket ids reads as a card, and this check is the least distinctive part of the
 * product: it earns its place only by being quiet.
 */
export function passesLuhn(digits: string): boolean {
  if (digits.length === 0) return false;
  let sum = 0;
  let doubling = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    const value = digits.charCodeAt(i) - 48;
    if (value < 0 || value > 9) return false;
    let contribution = value;
    if (doubling) {
      contribution *= 2;
      if (contribution > 9) contribution -= 9;
    }
    sum += contribution;
    doubling = !doubling;
  }
  return sum % 10 === 0;
}

/**
 * A built-in check: a shape, plus the copy shown when it fires.
 *
 * These are not `PolicyRule`s. A rule is data a person can switch off and edit;
 * these are properties of the text itself, they carry no exemplars and no
 * threshold, and they have no sensible single rewrite, so the card offers
 * `Remove it` rather than `Use this`.
 */
type PatternCheck = {
  id: string;
  title: string;
  why: string;
  severity: Severity;
  category: RuleCategory;
  /** Lower wins when two shapes claim overlapping spans. */
  precedence: number;
  pattern: RegExp;
  /**
   * Second opinion on a match the shape alone cannot settle: a check digit, a
   * reserved number range, or a boundary. Returning false drops the match
   * silently, which is the right outcome for a rung whose whole value is a
   * near-zero false-positive rate.
   */
  accept?: (match: string, text: string, start: number, end: number) => boolean;
};

function noWordCharAround(text: string, start: number, end: number): boolean {
  return !isWordChar(charBefore(text, start)) && !isWordChar(charAtIndex(text, end));
}

/**
 * True when the span is a self-contained number rather than a slice out of a
 * longer one.
 *
 * A digit on either side is the obvious case. The subtler one is a separator
 * carrying digits beyond it: `192.168.100.1234` contains `168.100.1234`, which is
 * exactly the shape of a dotted phone number, and `123-45-6789-0` contains a
 * well-formed identifier. Both would fire on a rung whose only claim is that it
 * almost never speaks out of turn. A space is not treated as a continuation,
 * because `ext 12 415-555-0132` is a phone number after a count and the digit
 * check above already covers the run-of-digits case.
 */
const NUMBER_CONTINUATIONS = new Set([".", "-"]);

function noDigitAround(text: string, start: number, end: number): boolean {
  if (isDigit(charBefore(text, start)) || isDigit(charAtIndex(text, end))) return false;
  const before = charBefore(text, start);
  if (before !== undefined && NUMBER_CONTINUATIONS.has(before)) {
    if (isDigit(charBefore(text, start - before.length))) return false;
  }
  const after = charAtIndex(text, end);
  if (after !== undefined && NUMBER_CONTINUATIONS.has(after)) {
    if (isDigit(charAtIndex(text, end + after.length))) return false;
  }
  return true;
}

/**
 * Secrets first (T2.2.1). These are the near-zero-false-positive wins: a prefix
 * plus a length is enough, ordinary prose does not produce them by accident, and
 * the person who pasted one nearly always wants to know.
 *
 * Personal-data shapes follow (T2.2.2), deliberately de-emphasised. They are the
 * least distinctive part of this product, so they are quiet by construction: a
 * bare ten-digit run is not treated as a phone number, a nine-digit run is not
 * treated as an identifier, and a card number needs its check digit.
 */
const PATTERN_CHECKS: readonly PatternCheck[] = [
  {
    id: "secret-api-key",
    title: "This looks like an API key",
    why: "A key pasted into a message stays in the thread for as long as the thread does, and anyone who can read it can use the key. Rotating the key is the only way to undo it.",
    severity: "high",
    category: "disclosure",
    precedence: 0,
    pattern: /sk-[A-Za-z0-9_-]{16,}/g,
    accept: (_match, text, start) => !isWordChar(charBefore(text, start)),
  },
  {
    id: "secret-access-token",
    // One prefix per token kind, all the same shape, so the character class
    // covers them together rather than repeating the pattern five times.
    title: "This looks like a personal access token",
    why: "A token carries whatever access its owner has, to everyone who can read the thread. It also tends to be copied onward long after the conversation has moved on.",
    severity: "high",
    category: "disclosure",
    precedence: 0,
    pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g,
    accept: (_match, text, start) => !isWordChar(charBefore(text, start)),
  },
  {
    id: "secret-cloud-key",
    title: "This looks like a cloud access key",
    why: "An access key identifier is half of a working credential, and the other half is usually in the same message. Treating the pair as public is the safe assumption once it has been sent.",
    severity: "high",
    category: "disclosure",
    precedence: 0,
    pattern: /AKIA[0-9A-Z]{16}/g,
    accept: (_match, text, start, end) => noWordCharAround(text, start, end),
  },
  {
    id: "secret-private-key",
    title: "This looks like a private key",
    why: "A private key in a thread is usable by everyone who can open the thread, and it cannot be un-sent. The only way back is to replace the key.",
    severity: "high",
    category: "disclosure",
    precedence: 0,
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g,
  },
  {
    id: "secret-signed-token",
    title: "This looks like a signed token",
    // Requiring the `eyJ` header is what keeps this quiet: it is the base64 of
    // the opening of a JSON object, so three dotted base64 segments that do not
    // start with it are almost never a token.
    why: "A signed token is a working credential until it expires, so sharing one shares whatever it grants. Whoever reads the thread later has the same access as whoever read it today.",
    severity: "high",
    category: "disclosure",
    precedence: 0,
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}/g,
    accept: (_match, text, start) => !isWordChar(charBefore(text, start)),
  },
  {
    id: "personal-data-card",
    title: "This looks like a payment card number",
    why: "Card numbers stay readable for as long as the thread does, and card data in a message is its own category of problem for both sides. A payment link keeps the number out of the record.",
    severity: "high",
    category: "disclosure",
    precedence: 1,
    pattern: /\d(?:[ -]?\d){12,18}/g,
    accept: (match, text, start, end) => {
      if (!noDigitAround(text, start, end)) return false;
      const digits = match.replace(/[ -]/g, "");
      if (digits.length < 13 || digits.length > 19) return false;
      return passesLuhn(digits);
    },
  },
  {
    id: "personal-data-ssn",
    title: "This looks like a Social Security number",
    why: "A government identifier is hard to change and useful to anyone who reads it, which makes a thread an expensive place to keep one. If it has to be shared, somewhere built for it is a better home.",
    severity: "high",
    category: "disclosure",
    precedence: 2,
    // Only the dashed form. A bare nine-digit run is far more often an order
    // number, and the false positives would cost more than the catches are worth.
    pattern: /(\d{3})-(\d{2})-(\d{4})/g,
    accept: (match, text, start, end) => {
      if (!noDigitAround(text, start, end)) return false;
      const [area, group, serial] = match.split("-");
      if (area === undefined || group === undefined || serial === undefined) return false;
      // Ranges the issuing authority has never allocated, so a number in them is
      // a placeholder or a coincidence rather than somebody's identifier.
      if (area === "000" || area === "666" || area.startsWith("9")) return false;
      return group !== "00" && serial !== "0000";
    },
  },
  {
    id: "personal-data-phone",
    title: "This looks like a phone number",
    why: "Contact details are visible to everyone in the thread, now and whenever it is read again later. Worth a look at whether the person expected that.",
    severity: "low",
    category: "disclosure",
    precedence: 3,
    // A separator is required somewhere. Ten bare digits are as likely to be an
    // identifier as a phone number, and this check is not worth a false positive.
    pattern: /(?:\+1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}/g,
    accept: (_match, text, start, end) => noDigitAround(text, start, end),
  },
  {
    id: "personal-data-email",
    title: "This looks like an email address",
    why: "An address in a shared thread is readable by everyone in it, including people who join later. Worth a look at whether the person expected that.",
    severity: "low",
    category: "disclosure",
    precedence: 4,
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    accept: (match) => !match.startsWith(".") && !match.includes(".."),
  },
];

/** The ids this rung can emit without any rule set, for provenance and tests. */
export const BUILT_IN_CHECK_IDS: readonly string[] = PATTERN_CHECKS.map((c) => c.id);

export type DeterministicOptions = {
  /** Leave the built-in secret and personal-data checks out of this scan. */
  skipBuiltIns?: boolean;
  /**
   * True when a negator governs `cue` in `text`.
   *
   * Injected rather than imported so the negator list and the clause definition
   * stay in one place for the whole engine (T2.1.6b). It matters here and not only
   * in the semantic rung: `I can't move this to my personal phone, sorry` trips the
   * off-record phrases with no model involved at all, and telling someone they
   * moved a conversation off the record when they refused to is the single most
   * damaging card this product can render (T2.1.6b.3, T2.1.6b.4). With no predicate
   * supplied the phrases fire unguarded, which is fixed by wiring the predicate in
   * rather than by softening the phrase list.
   *
   * The two arguments are `(text, cue)` so `negation.ts`'s own `isNegated` drops
   * straight in with no adapter to write and none to get wrong.
   */
  isNegated?: (text: string, cue: string) => boolean;
  /**
   * Called when one rule throws, so a caller can say "that rule did not run"
   * instead of implying a clean draft (T2.2.7).
   */
  onRuleError?: (ruleId: string, error: unknown) => void;
};

/**
 * Every rule in this rung is evaluated inside its own try/catch (T2.2.7).
 *
 * A rule can come from a person's own settings, and this rung runs on every
 * debounced keystroke, so the failure mode being closed here is not theoretical:
 * one malformed rule degrades to "that rule did not run", never to "the scan
 * threw" (F16, T2.6.8).
 */
function report(ruleId: string, opts: DeterministicOptions, error: unknown): void {
  try {
    opts.onRuleError?.(ruleId, error);
  } catch {
    // A reporting callback that throws must not become the failure it reports.
  }
}

function guard<T>(
  ruleId: string,
  opts: DeterministicOptions,
  run: () => T[],
): T[] {
  try {
    return run();
  } catch (error) {
    report(ruleId, opts, error);
    return [];
  }
}

/**
 * The guard has to cover reading the rule's own shape, not only matching with it.
 * An imported rule can arrive with no `match` at all, and inspecting `match.kind`
 * before entering the try/catch is how a malformed rule takes the scan down from
 * outside the thing meant to contain it.
 */
function ruleIdOf(rule: PolicyRule): string {
  try {
    return typeof rule?.id === "string" && rule.id.length > 0 ? rule.id : "unknown-rule";
  } catch {
    return "unknown-rule";
  }
}

/**
 * Secrets and personal-data shapes. No rule set required, which is the point:
 * these fire while the encoder is still downloading.
 */
export function scanBuiltInPatterns(
  text: string,
  opts: DeterministicOptions = {},
): Finding[] {
  if (text.length === 0) return [];
  const findings: Finding[] = [];

  for (const check of PATTERN_CHECKS) {
    const fromCheck = guard(check.id, opts, () => {
      const hits: Finding[] = [];
      for (const match of text.matchAll(check.pattern)) {
        if (hits.length >= MAX_FINDINGS_PER_RULE) break;
        const at = match.index;
        if (at === undefined) continue;
        const matched = match[0];
        if (matched.length === 0) continue;
        const end = at + matched.length;
        if (check.accept && !check.accept(matched, text, at, end)) continue;
        hits.push({
          ruleId: check.id,
          ruleSource: "company",
          title: check.title,
          severity: check.severity,
          category: check.category,
          why: check.why,
          // No `replacement`. There is no single right rewrite for a secret or an
          // identifier, so the card offers `Remove it` (T10.1.2).
          matchedText: text.slice(at, end),
          start: at,
          end,
          source: "pattern",
        });
      }
      return hits;
    });
    findings.push(...fromCheck);
  }

  return dropOverlappingPatterns(findings);
}

/**
 * A phone number sits inside a card number, and a card number sits inside a long
 * digit run, so two shapes routinely claim overlapping spans. That overlap is an
 * artefact of how the shapes are written rather than two things worth saying, so
 * the more specific check wins and the other is dropped.
 *
 * This applies only within the built-in family. Collapsing a term rule against a
 * semantic rule is a different question with a different answer, and it belongs
 * in the orchestrator's dedupe (T2.6.3, F8) where severity is what decides.
 */
function dropOverlappingPatterns(findings: Finding[]): Finding[] {
  const rank = new Map(PATTERN_CHECKS.map((c) => [c.id, c.precedence]));
  const ordered = [...findings].sort(
    (a, b) =>
      (rank.get(a.ruleId) ?? 0) - (rank.get(b.ruleId) ?? 0) ||
      a.start - b.start ||
      (b.end - b.start) - (a.end - a.start),
  );
  const kept: Finding[] = [];
  for (const finding of ordered) {
    const clashes = kept.some((k) => finding.start < k.end && k.start < finding.end);
    if (!clashes) kept.push(finding);
  }
  return kept;
}

function findingFromRule(rule: PolicyRule, match: TermMatch): Finding {
  return {
    ruleId: rule.id,
    ruleSource: rule.source,
    title: rule.title,
    severity: rule.severity,
    category: rule.category,
    why: rule.why,
    replacement: rule.replacement,
    matchedText: match.text,
    start: match.start,
    end: match.end,
    source: "pattern",
  };
}

/**
 * `terms` rules (T10.1.3). They evaluate here rather than in the semantic rung,
 * which is why "no swearing" is instant while "harsh criticism" waits for the
 * encoder.
 *
 * `rules` is the effective set: already merged, already filtered by the recipient
 * context, already stripped of disabled rules and of tone and language rules on a
 * labour-relations sentence (T2.6.1, T2.1.7). Nothing is re-derived here, because
 * a second copy of that filter is a second place for it to be wrong.
 */
export function scanTermRules(
  text: string,
  rules: readonly PolicyRule[],
  opts: DeterministicOptions = {},
): Finding[] {
  if (text.length === 0) return [];
  // The iteration is outside the per-rule guard, so a rule set that is not a list
  // at all takes the scan down from outside the thing meant to contain it. An
  // imported file or a stale stored value can be an object where an array was
  // expected, and T2.2.7 is precisely about not trusting rule data. Reported
  // rather than dropped, so the caller can still say something did not run.
  if (!Array.isArray(rules)) {
    report("unknown-rule", opts, new TypeError("rule set is not an array"));
    return [];
  }
  const findings: Finding[] = [];

  for (const rule of rules) {
    const fromRule = guard(ruleIdOf(rule), opts, () => {
      if (rule === null || typeof rule !== "object") return [];
      if (rule.enabled === false) return [];
      const match = rule.match;
      if (match === undefined || match === null || match.kind !== "terms") return [];
      /**
       * A rule that DECLARES `kind: "terms"` but carries a non-array `terms` is
       * malformed, not out of scope. Returning silently here was the difference
       * between "that rule did not run" and "this draft is clean", and only the
       * first is true. An imported or stale personal rule is the likeliest
       * source, so throw into the guard, which reports it and lets the scan
       * degrade honestly.
       */
      if (!Array.isArray(match.terms)) {
        throw new TypeError(`terms rule ${ruleIdOf(rule)} has a non-array terms list`);
      }
      return matchTerms(text, match.terms, match.wholeWord === true)
        .slice(0, MAX_FINDINGS_PER_RULE)
        .map((termMatch) => findingFromRule(rule, termMatch));
    });
    findings.push(...fromRule);
  }

  return findings;
}

/**
 * Deterministic phrase coverage for `moving-off-record` (T2.1.5). Belt and
 * braces on the rule a visitor is most likely to test by hand, and it works
 * before the encoder does.
 *
 * The phrases fire only when the rule itself is in the effective set, so the
 * recipient gate still governs them: `moving-off-record` is external-only, and a
 * phrase check that ignored that would flag "text me" in an internal thread and
 * quietly undo the recipient-switch moment the whole demo is built around.
 */
export function scanOffRecordPhrases(
  text: string,
  rules: readonly PolicyRule[],
  opts: DeterministicOptions = {},
): Finding[] {
  return guard(OFF_RECORD_RULE_ID, opts, () => {
    const rule = rules.find((r) => ruleIdOf(r) === OFF_RECORD_RULE_ID);
    if (rule === undefined || rule.enabled === false) return [];
    // If the rule has been authored as a terms rule, `scanTermRules` already owns
    // it and running both would put two cards on one phrase.
    if (rule.match === undefined || rule.match.kind !== "semantic") return [];

    return matchTerms(text, OFF_RECORD_PHRASES, true)
      .filter((match) => opts.isNegated?.(text, match.text) !== true)
      .slice(0, MAX_FINDINGS_PER_RULE)
      .map((match) => findingFromRule(rule, match));
  });
}

/**
 * The whole rung, in the order the orchestrator calls it (T2.6.2): after the
 * context gate, before segmentation, independently of the model.
 *
 * `rules` is required rather than optional on purpose. Off-record phrases and
 * term rules both take their copy and their severity from the rule set, so a
 * caller that forgot to pass it would get a scan that silently found less. A
 * missing argument that the compiler catches is better than a silent false
 * negative that nothing catches.
 */
export function scanDeterministic(
  text: string,
  rules: readonly PolicyRule[],
  opts: DeterministicOptions = {},
): Finding[] {
  const findings: Finding[] = [
    ...(opts.skipBuiltIns === true ? [] : scanBuiltInPatterns(text, opts)),
    ...scanOffRecordPhrases(text, rules, opts),
    ...scanTermRules(text, rules, opts),
  ];

  // Reading order within this rung. The orchestrator re-sorts by severity across
  // both rungs (T2.6.4); sorting here only makes the output stable to compare.
  return findings.sort(
    (a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start),
  );
}
