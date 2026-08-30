/**
 * The semantic rung (T2.5). Pure, synchronous, and it takes vectors.
 *
 * **This module never fetches an embedding.** All worker contact lives in the
 * `Embed` closure the orchestrator is constructed with, which is what makes this
 * rung testable in Node at all (F28): the only embedder in the product is a
 * worker owned by a React hook, so a module that reached for one could not be
 * exercised without a 23MB download and a browser.
 *
 * **A semantic rule is a CONJUNCTION, not a threshold.** Measured on the shipped
 * model, `we cannot guarantee your data never leaves the US` scores 0.978 against
 * the residency exemplars while the affirmative `we guarantee your data never
 * leaves the US` scores 0.964. The refusal outscores the promise, and it does so
 * on every rule, because mean-pooled MiniLM encodes topic and vocabulary rather
 * than stance. No threshold over max-over-exemplars can separate a promise from a
 * refusal to promise. Anyone who simplifies this back to a bare cosine comparison
 * ships a product that flags the careful writer at the highest confidence in the
 * whole fixture space, which is the single most damaging card it can render.
 *
 * So the embedding is the recall rung, and the cue plus negator gate is what makes
 * the result mean anything. The three checks run cheapest-first, so a segment with
 * no cue costs one substring search rather than 384 multiplications per exemplar.
 */

import { isNegated } from "./negation";
import { embeddingText } from "./segment";
import type { Finding, PolicyRule, Segment, Severity } from "./types";

/**
 * Severity as a sortable number. Exported because the orchestrator's dedupe and
 * final ordering ask the same question, and two copies of this map is two places
 * for `high` to stop being first. It lives here rather than in `scan.ts` because
 * `scan.ts` imports this module, so the other direction would be a cycle.
 */
export const SEVERITY_RANK: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function severityRank(severity: Severity): number {
  return SEVERITY_RANK[severity] ?? SEVERITY_RANK.low;
}

export type SemanticOptions = {
  /**
   * Called when one rule cannot be evaluated: no exemplar vectors, no usable
   * threshold, a vector of the wrong width, or a rule that throws while being
   * read. Reported rather than swallowed, because every one of those cases is a
   * silent false negative for that rule and the caller is the only thing that can
   * say so out loud.
   */
  onRuleError?: (ruleId: string, error: unknown) => void;
};

/** Vectors arrive normalised, so cosine similarity is a dot product (T2.5.2). */
function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * The best exemplar for this segment, or null when the rule has nothing to
 * compare against. A width mismatch is a caller bug rather than a data
 * condition, so it is named rather than quietly treated as a low score.
 */
function maxSimilarity(
  vector: Float32Array,
  exemplars: readonly Float32Array[],
): number | null {
  let best: number | null = null;
  for (const exemplar of exemplars) {
    if (!(exemplar instanceof Float32Array)) continue;
    if (exemplar.length !== vector.length) {
      throw new Error(
        `exemplar vector has ${exemplar.length} dims, segment vector has ${vector.length}`,
      );
    }
    const score = dot(vector, exemplar);
    if (best === null || score > best) best = score;
  }
  return best;
}

/**
 * The first cue of `cues` that is present in `text` and not governed by a
 * negator, or null.
 *
 * Presence is tested against `embeddingText`, not the raw draft, so markup cannot
 * hide a cue: `we **guarantee** it` has to match the cue `guarantee` or the
 * negator gate never gets a chance to run and the rule is simply dead on emphasis.
 *
 * The substring test comes first because it is the cheap one. `isNegated` splits
 * clauses and tokenises; the dot product is cheaper than that and still runs last,
 * because a segment that clears the gate is rare and a segment with no cue at all
 * is the overwhelming common case.
 */
export function ungovernedCue(
  text: string,
  cues: readonly string[] | undefined,
): string | null {
  if (!Array.isArray(cues)) return null;
  const haystack = embeddingText(text).toLowerCase();
  if (haystack.length === 0) return null;
  for (const cue of cues) {
    if (typeof cue !== "string") continue;
    const needle = embeddingText(cue).toLowerCase();
    if (needle.length === 0) continue;
    if (!haystack.includes(needle)) continue;
    // `isNegated` answers "stay quiet", so a governed cue and an absent cue both
    // come back true. Only a present, ungoverned cue licenses a finding.
    if (isNegated(text, cue)) continue;
    return cue;
  }
  return null;
}

/**
 * One card per segment (T2.5.5): highest severity, then highest score. Two cards
 * on one sentence is not twice the guidance, it is a wall that reads as noise, and
 * the second card is always about the same words as the first.
 */
function outranks(candidate: Finding, incumbent: Finding): boolean {
  const bySeverity = severityRank(candidate.severity) - severityRank(incumbent.severity);
  if (bySeverity !== 0) return bySeverity < 0;
  return (candidate.score ?? 0) > (incumbent.score ?? 0);
}

function report(
  ruleId: string,
  opts: SemanticOptions,
  error: unknown,
): void {
  try {
    opts.onRuleError?.(ruleId, error);
  } catch {
    // A reporting callback that throws must not become the failure it reports.
  }
}

function ruleIdOf(rule: PolicyRule): string {
  try {
    return typeof rule?.id === "string" && rule.id.length > 0 ? rule.id : "unknown-rule";
  } catch {
    return "unknown-rule";
  }
}

/**
 * Match every segment against every semantic rule.
 *
 * `segmentVectors` is index-aligned with `segments`, and `exemplarVectors` maps a
 * rule id to that rule's exemplar vectors. `rules` is the EFFECTIVE set: already
 * filtered by recipient context, already stripped of disabled rules and of tone
 * and language rules on a labour-relations sentence. Nothing is re-derived here,
 * because a second copy of that filter is a second place for it to be wrong.
 *
 * A mismatched vector count is a caller contract violation rather than a data
 * condition, so it throws. The orchestrator catches it and resolves the scan with
 * `ranSemantic: false`, which tells the UI the rung did not run instead of letting
 * an empty result read as a clean draft.
 */
export function matchSemantic(
  segments: readonly Segment[],
  rules: readonly PolicyRule[],
  segmentVectors: readonly Float32Array[],
  exemplarVectors: ReadonlyMap<string, readonly Float32Array[]>,
  opts: SemanticOptions = {},
): Finding[] {
  if (segmentVectors.length !== segments.length) {
    throw new Error(
      `matchSemantic: ${segments.length} segment(s) but ${segmentVectors.length} vector(s)`,
    );
  }
  if (!Array.isArray(rules)) {
    report("unknown-rule", opts, new TypeError("rule set is not an array"));
    return [];
  }

  const findings: Finding[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const vector = segmentVectors[i];
    let best: Finding | null = null;

    for (const rule of rules) {
      // Per rule, as in the deterministic rung: one unusable rule costs that rule
      // and nothing else. Rules can be user-authored and their exemplar vectors
      // can be a stale cache from a superseded model revision.
      try {
        if (rule === null || typeof rule !== "object") continue;
        if (rule.enabled === false) continue;
        const match = rule.match;
        if (match === undefined || match === null || match.kind !== "semantic") continue;

        const cue = ungovernedCue(segment.text, match.cues);
        if (cue === null) continue;

        if (!(vector instanceof Float32Array) || vector.length === 0) {
          throw new Error(`no usable vector for segment ${i}`);
        }
        const exemplars = exemplarVectors.get(rule.id);
        if (exemplars === undefined || exemplars.length === 0) {
          throw new Error("no exemplar vectors for this rule");
        }
        const threshold = match.threshold;
        if (typeof threshold !== "number" || !Number.isFinite(threshold)) {
          // Deliberately not defaulted. Inventing a threshold here would publish a
          // number nobody calibrated, and T2.7 is the only thing allowed to choose
          // one.
          throw new Error(`threshold is not a number: ${String(threshold)}`);
        }

        const score = maxSimilarity(vector, exemplars);
        if (score === null || score < threshold) continue;

        const candidate: Finding = {
          ruleId: rule.id,
          ruleSource: rule.source,
          title: rule.title,
          severity: rule.severity,
          category: rule.category,
          why: rule.why,
          replacement: rule.replacement,
          // The ORIGINAL segment text, never the embedding form. The composer
          // highlights and replaces against what the person typed, so
          // `draft.slice(start, end) === matchedText` has to hold.
          matchedText: segment.text,
          start: segment.start,
          end: segment.end,
          source: "semantic",
          score,
        };
        if (best === null || outranks(candidate, best)) best = candidate;
      } catch (error) {
        report(ruleIdOf(rule), opts, error);
      }
    }

    if (best !== null) findings.push(best);
  }

  return findings;
}
