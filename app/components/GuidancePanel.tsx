"use client";

/**
 * The region below the composer: cards, the internal line, the clean line.
 *
 * Below the composer, never a modal and never a toast (T4.1.4). A modal implies
 * enforcement, and this product does not enforce. It also holds a minimum height
 * from first paint, so a card arriving never moves the composer under a live
 * cursor.
 *
 * Two rules here are the ones that were previously got wrong in three documents
 * at once:
 *
 *   - **The internal line is DERIVED from the effective rule set, never a fixed
 *     string** (F26). Three documents carried three different literal values for
 *     it, and the task pointed the implementer at the stale one, so a tone card
 *     would have rendered directly beneath a line saying checks only apply
 *     outside the company. Deriving it means the line cannot drift as rules are
 *     added, removed, or switched off in settings.
 *   - **The line and a card are mutually exclusive** (§5.2). Internal with a tone
 *     finding renders the card and no internal line, or the product contradicts
 *     itself on screen. That is why the precedence below is a single ordered
 *     branch rather than two independent conditions.
 *
 * Nothing here moves focus. A card appearing while someone is typing must not
 * move the caret, which is the most likely accessibility mistake in this product,
 * so the region is `aria-live="polite"`: announced, never interrupting.
 */

import { effectiveRules } from "@/app/lib/scan";
import type { Finding, PolicyRule, RecipientKind, RuleCategory, Severity } from "@/app/lib/types";
import { FindingCard, type RemediationOption } from "./FindingCard";

/** §14 copy deck. */
const COPY = {
  clean: "Nothing to flag.",
  truncated: "Only the first part of this message was checked.",
  noRules: "No rules are switched on.",
  internalOpening: "Internal conversation.",
  guidanceLabel: "Guidance on your draft",
} as const;

/** §7: at most three cards at once, and `panel.overflow` for the rest. */
export const MAX_CARDS = 3;

export function overflowLine(count: number): string {
  return `${count} more further down your message.`;
}

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

/** Severity first, then position in the draft (§7). Stable and total. */
export function orderedFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.start - b.start,
  );
}

export function cappedFindings(findings: readonly Finding[]): {
  shown: Finding[];
  overflow: number;
} {
  const ordered = orderedFindings(findings);
  return {
    shown: ordered.slice(0, MAX_CARDS),
    overflow: Math.max(0, ordered.length - MAX_CARDS),
  };
}

/**
 * Every category with at least one enabled rule scoped to `kind`.
 *
 * Derived through `effectiveRules`, which is the same function the scan itself
 * uses, so the line on screen and the rules that actually ran cannot disagree.
 */
export function scopedCategories(
  rules: readonly PolicyRule[],
  kind: RecipientKind,
): Set<RuleCategory> {
  return new Set(effectiveRules(rules, kind).map((rule) => rule.category));
}

/**
 * Findings that could still have been produced under `kind`.
 *
 * Used on a recipient switch, where clearing every finding is wrong (F26):
 * internal conversations have tone findings and clearing them on every switch
 * discards exactly what the switch is there to demonstrate. Dropping only the
 * out-of-scope ones means a residency card disappears the instant the visitor
 * switches to the internal thread, without waiting for the re-scan, while a tone
 * card survives the trip in both directions.
 */
export function findingsInScope(
  findings: readonly Finding[],
  rules: readonly PolicyRule[],
  kind: RecipientKind,
): Finding[] {
  const categories = scopedCategories(rules, kind);
  return findings.filter((finding) => categories.has(finding.category));
}

/** Canonical order, so the line reads the same way every time it is derived. */
const CATEGORY_ORDER: readonly RuleCategory[] = [
  "claim",
  "commitment",
  "channel",
  "disclosure",
  "tone",
  "language",
];

/** The plain word for each category. None of them appears on §14's banned list. */
const CATEGORY_NOUN: Record<RuleCategory, string> = {
  claim: "claim",
  commitment: "commitment",
  channel: "channel",
  disclosure: "disclosure",
  tone: "tone",
  language: "language",
};

function nounList(categories: readonly RuleCategory[]): string {
  const words = categories.map((category) => CATEGORY_NOUN[category]);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

/**
 * `panel.internal`, filled from the effective rule set.
 *
 * Naming which categories are on and which are off is load-bearing: without it
 * the silence reads as a broken product rather than as the product's central
 * idea, and it is what teaches the visitor that scoping is per rule rather than a
 * master switch. When nothing at all is enabled it falls through to
 * `status.noRules`, because "checks are off, checks are on" with both lists empty
 * would be a sentence about nothing.
 */
export function internalGuidanceLine(rules: readonly PolicyRule[]): string {
  /**
   * Nothing enabled in ANY context is the `status.noRules` case, and it is
   * checked first: with every rule switched off, listing six categories as off
   * would be a sentence about rules that are not in play at all.
   */
  const enabledAnywhere = new Set([
    ...scopedCategories(rules, "internal"),
    ...scopedCategories(rules, "external-guest"),
    ...scopedCategories(rules, "external-domain"),
  ]);
  if (enabledAnywhere.size === 0) return COPY.noRules;

  const on = scopedCategories(rules, "internal");
  /**
   * A category is named as off when the rule set has a rule for it that does not
   * apply here, whether it is scoped elsewhere or switched off in settings. Both
   * are honestly "off" from where the visitor is sitting.
   */
  const present = new Set(rules.map((rule) => rule.category));

  const onList = CATEGORY_ORDER.filter((category) => on.has(category));
  const offList = CATEGORY_ORDER.filter(
    (category) => present.has(category) && !on.has(category),
  );

  const clauses: string[] = [];
  if (offList.length > 0) clauses.push(`${nounList(offList)} checks are off`);
  if (onList.length > 0) clauses.push(`${nounList(onList)} checks are on`);
  if (clauses.length === 0) return COPY.noRules;

  const body = clauses.join(", ");
  return `${COPY.internalOpening} ${body[0].toUpperCase()}${body.slice(1)}.`;
}

/**
 * Every line this region can show instead of a card, on one class.
 *
 * They arrive by the same 140ms fade-and-rise the cards use, because they arrive
 * for the same reason and at the same moment. `Nothing to flag.` snapping into
 * place while a card two seconds earlier faded in would read as two different
 * products. The reading measure matters for the internal line in particular, which
 * is a derived sentence that grows with the rule set.
 */
const NOTE_CLASS = "animate-rise-in max-w-reading text-sm text-ink-secondary";

type GuidancePanelProps = {
  /** Already filtered to text that still exists and to what is not suppressed. */
  findings: readonly Finding[];
  rules: readonly PolicyRule[];
  kind: RecipientKind;
  truncated: boolean;
  /** `panel.clean`, shown for 2s after a scan resolved with nothing to say. */
  clean: boolean;
  onAccept: (finding: Finding, option: RemediationOption) => void;
  onKeep: (finding: Finding) => void;
};

export function GuidancePanel({
  findings,
  rules,
  kind,
  truncated,
  clean,
  onAccept,
  onKeep,
}: GuidancePanelProps) {
  const { shown, overflow } = cappedFindings(findings);

  return (
    <div
      aria-live="polite"
      aria-label={COPY.guidanceLabel}
      /* Reserved from first paint. Empty, it holds exactly one status line's
         worth of height rather than collapsing to zero (§2). */
      className="mt-5 min-h-guidance"
    >
      {shown.length > 0 ? (
        <div className="flex flex-col gap-4">
          {shown.map((finding) => (
            <FindingCard
              key={`${finding.ruleId}:${finding.start}:${finding.end}`}
              finding={finding}
              onAccept={(option) => onAccept(finding, option)}
              onKeep={() => onKeep(finding)}
            />
          ))}
          {overflow > 0 ? (
            <p className={NOTE_CLASS}>{overflowLine(overflow)}</p>
          ) : null}
          {truncated ? <p className={NOTE_CLASS}>{COPY.truncated}</p> : null}
        </div>
      ) : kind === "internal" ? (
        <p className={NOTE_CLASS}>{internalGuidanceLine(rules)}</p>
      ) : clean ? (
        <p className={NOTE_CLASS}>{COPY.clean}</p>
      ) : truncated ? (
        <p className={NOTE_CLASS}>{COPY.truncated}</p>
      ) : null}
    </div>
  );
}
