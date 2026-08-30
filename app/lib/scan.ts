/**
 * The orchestrator (T2.6). Context gate, then the deterministic rung, then the
 * semantic rung, then dedupe and ordering.
 *
 * **`scan` never throws** (T2.6.8). A model failure, a hostile rule, a stale
 * exemplar cache: every one of them resolves with `ranSemantic: false` plus
 * whatever the pattern rung found. A checker that crashes on someone's draft is
 * worse than one that admits it only did half the job, and a rejected promise in
 * a debounced keystroke handler would take the composer down with it.
 *
 * **`ranSemantic: false` means a semantic finding could have been missed**, which
 * is what the UI turns into `status.degraded` rather than implying a clean draft.
 * It is therefore false when the rung was skipped or failed, and true when the
 * rung completed everything the gate left it to do, including the case where the
 * gate left it nothing: with no semantic rule in scope there is no detection to
 * miss, and reporting degraded there would tell an internal-thread visitor the
 * product is broken when it is working exactly as designed.
 *
 * **Why a constructor rather than a bare function.** Without an injectable
 * `Embed`, the semantic rung, the dedupe precedence branch, and the out-of-order
 * race guard are all untestable in Node (F28): every semantic rule needs vectors,
 * and the only embedder in the product is a worker owned by a React hook. The call
 * site E4, E5, and E6 use is deliberately unchanged; only construction is new.
 */

import { scanDeterministic } from "./deterministic";
import { isLabourRelations } from "./labour-exclusion";
import { isNegated } from "./negation";
import { matchSemantic, severityRank } from "./semantic";
import { embeddingText, maskExcisions, segment } from "./segment";
import type {
  DeviceKind,
  Embed,
  Finding,
  PolicyRule,
  Recipient,
  RecipientKind,
  RuleCategory,
  ScanResult,
  Segment,
} from "./types";

/**
 * Debounce is the UI's decision to make, not this module's, but the two numbers
 * belong next to the thing they debounce. 300ms idle on WebGPU, 600ms on WASM:
 * faster feels twitchy mid-word, slower feels broken, and WASM inference is slow
 * enough that 300ms would queue scans behind each other.
 */
export const DEBOUNCE_MS = 300;
export const DEBOUNCE_MS_WASM = 600;

export function debounceMs(device: DeviceKind | undefined): number {
  return device === "wasm" ? DEBOUNCE_MS_WASM : DEBOUNCE_MS;
}

/**
 * The two categories a labour-relations sentence silences (T2.1.7.2, D23).
 *
 * `claim`, `commitment`, `channel`, and `disclosure` are deliberately absent: an
 * unapproved pricing commitment is still worth catching in a sentence that
 * mentions headcount, and a pasted API key does not stop being a pasted API key
 * because the message is about the on-call rota.
 */
export const LABOUR_SUPPRESSED_CATEGORIES: ReadonlySet<RuleCategory> = new Set([
  "tone",
  "language",
]);

/**
 * How much two spans must share before they are treated as the same finding said
 * twice. Below this they are two things worth saying, unless one contains the
 * other, which is handled separately.
 */
export const CO_EXTENSIVE_OVERLAP = 0.8;

/**
 * The context gate (T2.3). Filter by `appliesTo` before any async work happens:
 * the gate is a performance optimisation and the product's central idea at the
 * same time.
 *
 * **For `internal` this filters per rule; it is not a master switch** (F10). The
 * task previously said "for internal, return zero findings and skip the model
 * entirely", with a passing test asserting zero embedding calls, and that is
 * falsified by tone and language rules applying inside the company. The danger was
 * never the wrong line, it was the green test: whoever hit it later would have
 * scoped the tone rule external-only and killed internal tone checks with no
 * failing check anywhere.
 *
 * Exported because §5.2's `panel.internal` line is derived from the effective set
 * rather than hand-maintained, so the copy cannot drift as rules are toggled.
 */
export function effectiveRules(
  rules: readonly PolicyRule[] | undefined,
  kind: RecipientKind | undefined,
): PolicyRule[] {
  if (!Array.isArray(rules)) return [];
  /**
   * A missing or unrecognised recipient falls back to the MOST protective
   * context, not to none.
   *
   * Returning `[]` here scanned nothing and resolved as a clean draft, so a
   * caller that forgot to set a recipient, or set a kind this build does not
   * know, got silence that reads as approval. Failing toward "treat it as
   * leaving the company" costs at worst one dismissable card. The opposite
   * mistake is invisible, and invisible is the whole failure class this engine
   * is built to avoid.
   */
  const scoped: RecipientKind =
    kind === "internal" || kind === "external-guest" || kind === "external-domain"
      ? kind
      : "external-domain";
  const kept: PolicyRule[] = [];
  for (const rule of rules) {
    try {
      if (rule === null || typeof rule !== "object") continue;
      if (rule.enabled === false) continue;
      if (!Array.isArray(rule.appliesTo)) continue;
      if (!rule.appliesTo.includes(scoped)) continue;
      kept.push(rule);
    } catch {
      // A rule whose own shape cannot be read is not in scope for anything.
    }
  }
  return kept;
}

/** Hard clause terminators, the same set segmentation treats as hard boundaries. */
const SENTENCE_BREAK = /[.?!;\n]/;

/**
 * The sentence a span sits in, read off the masked draft.
 *
 * The labour-relations gate is evaluated per SENTENCE rather than per clause, and
 * the difference is not cosmetic. `this rota is a mess, so whoever wrote it
 * clearly had no idea` splits at `, so`, and the clause carrying the tone cue
 * contains no labour topic of its own, so a clause-scoped gate would flag
 * protected speech about scheduling. The exclusion's mistakes are supposed to run
 * one way: matching a sentence that turns out not to be about work conditions
 * costs one tone card nobody sees.
 *
 * Masked rather than raw, so a labour word inside a fenced code block or a URL is
 * not what triggers the exclusion.
 */
function sentenceAround(masked: string, start: number, end: number): string {
  let from = Math.max(0, start);
  while (from > 0 && !SENTENCE_BREAK.test(masked[from - 1])) from--;
  let to = Math.min(masked.length, end);
  while (to < masked.length && !SENTENCE_BREAK.test(masked[to])) to++;
  return masked.slice(from, to);
}

/**
 * On error this answers "yes, suppress". Ambiguous means suppress and never
 * downgrade: if the gate cannot be evaluated, the outcome that costs a tone card
 * is better than the one that puts a card under a message about pay.
 */
function isLabourSentence(masked: string, start: number, end: number): boolean {
  try {
    return isLabourRelations(sentenceAround(masked, start, end));
  } catch {
    return true;
  }
}

/**
 * Are these two findings the same thing said twice?
 *
 * Two regimes collapse, and one does not. Spans that are substantially
 * co-extensive are one finding. A span strictly CONTAINED in a longer one is also
 * one finding, resolved by the one-card-per-sentence rule. Spans that merely clip
 * each other are two separate things and both stay.
 */
function collapses(a: Finding, b: Finding): boolean {
  const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
  if (overlap <= 0) return false;
  const contained =
    (a.start >= b.start && a.end <= b.end) || (b.start >= a.start && b.end <= a.end);
  if (contained) return true;
  const longest = Math.max(a.end - a.start, b.end - b.start, 1);
  return overlap / longest >= CO_EXTENSIVE_OVERLAP;
}

/**
 * Which of two collapsing findings survives (T2.6.3). Negative means `a` wins.
 *
 * **Severity first, and source only at equal severity.** The old rule was "prefer
 * `pattern` over `semantic` on overlapping spans", written when the deterministic
 * rung held nothing but secrets and personal data. Once term rules moved into that
 * rung it became a silent false negative generator (F8): in `Yes, we damn well
 * guarantee your data never leaves the US.` the term rule matches `damn` as a
 * one-word low-severity span sitting inside the clause the residency rule matches
 * at high severity, so source-first dedupe throws the residency promise away, the
 * only card reads `Strong language / low`, and the button says `Send` rather than
 * `Send anyway`. Nobody ever sees the promise. That is exactly the outcome T2.6.1
 * calls the worst possible output of this function.
 */
function preferenceOrder(a: Finding, b: Finding): number {
  const bySeverity = severityRank(a.severity) - severityRank(b.severity);
  if (bySeverity !== 0) return bySeverity;
  // At equal severity the deterministic rung wins: it is certain about what it
  // matched and easier to explain than a cosine.
  if (a.source !== b.source) return a.source === "pattern" ? -1 : 1;
  const byScore = (b.score ?? 0) - (a.score ?? 0);
  if (byScore !== 0) return byScore;
  if (a.start !== b.start) return a.start - b.start;
  const byLength = b.end - b.start - (a.end - a.start);
  if (byLength !== 0) return byLength;
  return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
}

function dedupe(findings: readonly Finding[]): Finding[] {
  // Strongest first, then keep greedily. Every dropped finding is dropped in
  // favour of one that already beat it, so no ordering of the input can change the
  // outcome.
  const ranked = [...findings].sort(preferenceOrder);
  const kept: Finding[] = [];
  for (const finding of ranked) {
    if (kept.some((k) => collapses(k, finding))) continue;
    kept.push(finding);
  }
  return kept;
}

/**
 * Reading order within a severity (T2.6.4). Severity first so the thing most worth
 * knowing is at the top, then `start`, so cards run down the message the way the
 * eye does.
 */
function inReadingOrder(findings: Finding[]): Finding[] {
  return findings.sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      a.start - b.start ||
      a.end - b.end ||
      (a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0),
  );
}

export type ScannerDeps = {
  embed: Embed;
  /** Rule id to that rule's exemplar vectors, precomputed once at `ready`. */
  exemplars: Map<string, Float32Array[]>;
  rules: PolicyRule[];
};

export type ScanOptions = {
  /**
   * Skip the semantic rung. E5 re-scans a generated rewrite this way, and a test
   * can exercise the deterministic rung with no model at all. It resolves
   * `ranSemantic: false`, because a semantic finding really could have been missed.
   */
  skipSemantic?: boolean;
};

/**
 * `ScanResult` plus the sequence guard (T2.6.6).
 *
 * A superseded result carries no findings, so a caller that ignores `superseded`
 * renders nothing stale rather than a phantom card from a draft that no longer
 * exists. Out-of-order embedding responses are the likeliest source of exactly
 * that, since a WASM scan of a long draft can finish after a later scan of a short
 * one. `superseded` is the discriminator a caller should branch on: it is the only
 * reason a result can be empty with `ranSemantic: false` and nothing wrong.
 */
export type SequencedScanResult = ScanResult & {
  readonly seq: number;
  readonly superseded: boolean;
};

export type Scanner = {
  scan(
    draft: string,
    recipient: Recipient,
    opts?: ScanOptions,
  ): Promise<SequencedScanResult>;
};

export function createScanner(deps: ScannerDeps): Scanner {
  /** Monotonic across the scanner's life. Every scan takes the next number. */
  let latest = 0;

  const finish = (
    seq: number,
    findings: readonly Finding[],
    truncated: boolean,
    ranSemantic: boolean,
    ranPattern: boolean = true,
  ): SequencedScanResult => {
    if (seq !== latest) {
      return {
        seq,
        superseded: true,
        findings: [],
        truncated: false,
        ranSemantic: false,
        ranPattern: false,
      };
    }
    return {
      seq,
      superseded: false,
      findings: inReadingOrder(dedupe(findings)),
      truncated,
      ranSemantic,
      ranPattern,
    };
  };

  const scan = async (
    draft: string,
    recipient: Recipient,
    opts: ScanOptions = {},
  ): Promise<SequencedScanResult> => {
    const seq = ++latest;
    try {
      if (typeof draft !== "string" || draft.length === 0) {
        // Nothing typed is not a degraded scan. There is no detection to miss.
        return finish(seq, [], false, true);
      }

      const rules = effectiveRules(deps.rules, recipient?.kind);
      const masked = maskExcisions(draft);

      // The deterministic rung runs first and needs no model, so this much is true
      // while the encoder is still downloading (T2.2.5). `isNegated` is wired
      // through to the off-record phrases (T2.1.6b.4): without it they fire on
      // `I can't move this to my personal phone, sorry`, telling someone they moved
      // a conversation off the record when they refused to, with no model involved.
      // A term rule that could not be evaluated is contained per rule so it cannot
      // take the scan down, but "contained" and "ran" are different claims, and a
      // clean result for a rule that never executed is a silent false negative.
      let patternDegraded = false;
      const onPatternRuleError = () => {
        patternDegraded = true;
      };
      const pattern = scanDeterministic(draft, rules, {
        isNegated,
        onRuleError: onPatternRuleError,
      }).filter(
        (finding) =>
          !LABOUR_SUPPRESSED_CATEGORIES.has(finding.category) ||
          !isLabourSentence(masked, finding.start, finding.end),
      );

      const { segments, truncated } = segment(draft);
      const semanticRules = rules.filter((rule) => rule.match?.kind === "semantic");

      if (opts.skipSemantic === true) {
        return finish(seq, pattern, truncated, false, !patternDegraded);
      }
      // Skip the encoder only when no surviving rule is semantic (T2.3.3). With
      // the internal context that depends entirely on the rule set: tone and
      // language rules are scoped to `internal`, so an internal draft normally
      // does run the model, and a version of this check that short-circuited on
      // the recipient alone would silently kill them.
      if (semanticRules.length === 0 || segments.length === 0) {
        return finish(seq, pattern, truncated, true, !patternDegraded);
      }

      let semantic: Finding[] = [];
      // A rule the semantic rung could not evaluate (no exemplar vectors from a
      // stale cache, a threshold that is not a number, a vector of the wrong
      // width) is contained per rule rather than taking the rung down, but it is
      // still a detection that did not happen. T2.6.8 puts a malformed rule and a
      // model failure in the same bucket: `ranSemantic: false`. Reporting `true`
      // here would let a rule that never ran read as a clean draft, which is the
      // one output this module must never produce.
      let ruleUnevaluated = false;
      try {
        const vectors = await deps.embed(segments.map((s) => embeddingText(s.text)));
        if (seq !== latest) return finish(seq, [], false, false);
        if (
          !Array.isArray(vectors) ||
          vectors.length !== segments.length ||
          !vectors.every((v) => v instanceof Float32Array && v.length > 0)
        ) {
          throw new Error("embed returned an unusable batch");
        }
        semantic = matchSemanticByLabourContext(
          segments,
          vectors,
          semanticRules,
          deps.exemplars,
          masked,
          () => {
            ruleUnevaluated = true;
          },
        );
      } catch {
        // A model failure, a stale exemplar cache, or a rule that cannot be
        // evaluated: resolve with what the pattern rung found and say the semantic
        // rung did not run. Silence dressed up as a clean draft is the one outcome
        // this function must never produce.
        return finish(seq, pattern, truncated, false, !patternDegraded);
      }

      return finish(seq, [...pattern, ...semantic], truncated, !ruleUnevaluated, !patternDegraded);
    } catch {
      // The outermost net. Nothing above is allowed to reject, and if something
      // does, an honest empty result beats an unhandled rejection inside a
      // debounced keystroke handler.
      return finish(seq, [], false, false, false);
    }
  };

  return { scan };
}

/**
 * The labour-relations exclusion, applied once here rather than inside any rule
 * (T2.1.7.4, D23), so a personal tone rule authored in E10 inherits it and cannot
 * opt out.
 *
 * It is applied to the effective RULE set per segment rather than to the findings
 * afterwards, and that ordering is load-bearing. One card per segment keeps the
 * highest severity, so if a suppressed tone rule won a segment and were filtered
 * out later, the pricing commitment in the same sentence would vanish with it.
 * T2.1.7.3 requires the opposite: the commitment still fires.
 */
function matchSemanticByLabourContext(
  segments: readonly Segment[],
  vectors: readonly Float32Array[],
  semanticRules: readonly PolicyRule[],
  exemplars: Map<string, Float32Array[]> | undefined,
  masked: string,
  onRuleError: (ruleId: string, error: unknown) => void,
): Finding[] {
  const vectorMap = exemplars instanceof Map ? exemplars : new Map<string, Float32Array[]>();

  const plainSegments: Segment[] = [];
  const plainVectors: Float32Array[] = [];
  const labourSegments: Segment[] = [];
  const labourVectors: Float32Array[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const labour = isLabourSentence(masked, seg.start, seg.end);
    (labour ? labourSegments : plainSegments).push(seg);
    (labour ? labourVectors : plainVectors).push(vectors[i]);
  }

  const findings = matchSemantic(plainSegments, semanticRules, plainVectors, vectorMap, {
    onRuleError,
  });
  if (labourSegments.length > 0) {
    const allowed = semanticRules.filter(
      (rule) => !LABOUR_SUPPRESSED_CATEGORIES.has(rule.category),
    );
    findings.push(
      ...matchSemantic(labourSegments, allowed, labourVectors, vectorMap, { onRuleError }),
    );
  }
  return findings;
}
