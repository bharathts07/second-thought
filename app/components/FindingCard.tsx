"use client";

/**
 * The guidance card. `plan/03` T3.2 calls it the product, and every decision
 * below is one sentence of the product's argument expressed in markup.
 *
 * The moment this card exists in is an INTERRUPTION, and the target is
 * noticeable in peripheral vision, calm on inspection, and never implying the
 * visitor did something wrong. They have not sent anything yet. So:
 *
 *   - There is no filled severity panel. The card is a raised neutral surface
 *     with a hairline box and a 2px severity rule down its left edge, which is
 *     the whole of the colour. A filled error container is the single thing most
 *     likely to make this read as a scold (`plan/03` "The design problem"), and
 *     tokens.css deliberately defines no `-panel` token to build one from.
 *   - `Use this` and `Keep mine` share one class constant, so they cannot drift
 *     apart into a primary button and a muted link. The moment one wins, the
 *     product is instructing rather than informing (T3.2.4, §7).
 *   - Every string comes from the §14 copy deck, checked against its banned list:
 *     no violation, breach, error, warning, alert, blocked, you must.
 *
 * Presentational only. It imports types and nothing else from the engine, takes
 * a `Finding` it does not interpret, and reports gestures upward.
 *
 * **Division of labour with the container (§10).** The list that renders these
 * owns `aria-live="polite"`, the three-card cap, and severity ordering; a live
 * region on each card would announce per card and fight itself. The card owns
 * having a heading and being a labelled landmark. Neither side moves focus: a
 * card appearing while someone types must not move the caret, which is the most
 * likely accessibility mistake in this product, so there is no `autoFocus` and
 * no ref-driven focus call anywhere below.
 */

import { useId } from "react";
import type { Finding, Severity } from "@/app/lib/types";
import { SeverityChip } from "./SeverityChip";

/** §14 copy deck. Transcribed, never composed, so wording is decided once. */
const COPY = {
  heading: "Worth a second thought",
  suggested: "Suggested wording",
  accept: "Use this",
  keep: "Keep mine",
  removeTerm: "Remove it",
  preparing: "Preparing a version in your words…",
  matchedOn: "Matched on your device",
  pattern: "pattern",
  fromCompany: "From your company",
  fromPersonal: "Your own rules",
} as const;

/**
 * One way to resolve a finding.
 *
 * Remediation is a LIST rather than an if/else between the approved wording and
 * a rewrite, because E5 appends a third, locally generated option (`In your
 * words`) and must not require a layout rewrite to do it. Each option carries
 * its own provenance label from the start for the same reason: §7 asks the card
 * to be honest about where each sentence came from, and retrofitting that onto a
 * branch is how one of the two branches ends up without it.
 *
 * `isDefault` is why ordering is a property of the data rather than a hardcoded
 * index. The rule's own wording is listed first and a generated rewrite second,
 * never the reverse (§7).
 */
export type RemediationOption = {
  id: string;
  /** The button's own words: `Use this`, or `Remove it` when there is nothing to substitute. */
  actionLabel: string;
  /** Section label above the quotation: `Suggested wording`, or `In your words` for E5. */
  heading?: string;
  /** Absent for a terms finding, where the remedy is deletion and there is no wording to show. */
  text?: string;
  /** Muted line under the quotation saying where this wording came from. */
  provenance?: string;
  isDefault?: boolean;
  /** E5's rewrite while it streams: shows `card.preparing` and offers no action yet. */
  pending?: boolean;
};

/**
 * The provenance line, split so the rule id and the score can render in the mono
 * face tokens.css reserves for exactly them, while the assembled string stays
 * available as one value to assert on.
 */
export function provenanceSegments(
  finding: Pick<Finding, "ruleId" | "source" | "score">,
): { prefix: string; detail: string } {
  if (finding.source === "pattern") {
    return { prefix: COPY.matchedOn, detail: COPY.pattern };
  }
  const detail =
    typeof finding.score === "number"
      ? `${finding.ruleId} · ${finding.score.toFixed(2)}`
      : finding.ruleId;
  return { prefix: COPY.matchedOn, detail };
}

export function provenanceLine(
  finding: Pick<Finding, "ruleId" | "source" | "score">,
): string {
  const { prefix, detail } = provenanceSegments(finding);
  return `${prefix} · ${detail}`;
}

/**
 * The option the rule itself supplies.
 *
 * A terms finding has no `replacement` (§13 R8: strong language has no single
 * sensible rewrite), so the action is `Remove it` and no quotation renders. That
 * is a different remedy, not a missing one, and it must not surface as a
 * `Use this` button with an empty box under it.
 */
export function ruleOption(finding: Finding): RemediationOption {
  const provenance =
    finding.ruleSource === "personal" ? COPY.fromPersonal : COPY.fromCompany;

  if (finding.replacement === undefined || finding.replacement === "") {
    return {
      id: `${finding.ruleId}:remove`,
      actionLabel: COPY.removeTerm,
      provenance,
      isDefault: true,
    };
  }

  return {
    id: `${finding.ruleId}:suggested`,
    actionLabel: COPY.accept,
    heading: COPY.suggested,
    text: finding.replacement,
    provenance,
    isDefault: true,
  };
}

/** Defaults first, everything else in the order the caller gave. Stable, by flag. */
export function remediationOptions(
  finding: Finding,
  extra: readonly RemediationOption[] = [],
): RemediationOption[] {
  const all = [ruleOption(finding), ...extra];
  return [...all.filter((o) => o.isDefault), ...all.filter((o) => !o.isDefault)];
}

/**
 * Widths and colours are declared per side rather than through the `border`
 * shorthand. Mixing `border` with `border-l-2` leaves the left width decided by
 * Tailwind's internal sort order, and the 2px severity rule is too load-bearing
 * to rest on that.
 */
const CARD_BASE =
  "animate-rise-in rounded-lg bg-raised shadow-raised border-t border-r border-b border-l-2 " +
  "border-t-hairline border-r-hairline border-b-hairline p-4 sm:p-5";

const CARD_RULE: Record<Severity, string> = {
  high: "border-l-severity-high-border",
  medium: "border-l-severity-medium-border",
  low: "border-l-severity-low-border",
};

/**
 * One class constant, used by both actions. This is T3.2.4 in the only form that
 * cannot rot: there is no second button style in this file to promote one to.
 * Full width on narrow screens per §11, auto once there is room.
 */
const ACTION_CLASS =
  "w-full sm:w-auto rounded-md border border-control bg-surface px-3 py-2 " +
  "text-sm font-medium text-ink transition-quiet hover:bg-sunken";

type FindingCardProps = {
  finding: Finding;
  /** The container replaces the span, then discards every finding and re-scans (§8.1). */
  onAccept: (option: RemediationOption) => void;
  /** Suppresses this rule plus this exact text, in memory, until the sentence changes (§8.2). */
  onKeep: () => void;
  /** E5's generated rewrite arrives here. */
  extraOptions?: readonly RemediationOption[];
};

export function FindingCard({
  finding,
  onAccept,
  onKeep,
  extraOptions,
}: FindingCardProps) {
  const titleId = useId();
  const options = remediationOptions(finding, extraOptions);
  const { prefix, detail } = provenanceSegments(finding);

  return (
    <section
      aria-labelledby={titleId}
      className={`${CARD_BASE} ${CARD_RULE[finding.severity]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs font-medium tracking-label text-ink-muted">
          {COPY.heading}
        </p>
        <SeverityChip severity={finding.severity} />
      </div>

      {/* Title first, reason second, wording third, actions last (T3.2.3). */}
      <h3
        id={titleId}
        className="mt-3 text-lg font-semibold tracking-tight text-ink"
      >
        {finding.title}
      </h3>

      <p className="mt-2 text-md text-ink-secondary">{finding.why}</p>

      {/* Quoted inside the card, so a non-visual visitor never has to go and
          find an underline in the composer (§10).
          A hairline rule and no fill, for two reasons. tokens.css licenses the
          severity `-wash` for the flagged span in the composer and nowhere else,
          and the filled surface in this card belongs to the SUGGESTION, which
          T3.2.3 wants visually distinct from the visitor's own sentence. */}
      <blockquote className="mt-3 border-l border-l-hairline pl-3 text-base text-ink-secondary">
        &ldquo;{finding.matchedText}&rdquo;
      </blockquote>

      <ul className="mt-4 flex flex-col gap-4">
        {options.map((option, index) => (
          <li key={option.id}>
            {option.heading ? (
              <p className="text-xs font-medium text-ink-secondary">
                {option.heading}
              </p>
            ) : null}

            {/* A quotation with its own sunken surface, never an editable field
                (T3.2.5). It is a suggestion to accept, not a form to fill in. */}
            {option.pending ? (
              <p className="mt-1 text-sm text-ink-muted">{COPY.preparing}</p>
            ) : option.text ? (
              <blockquote className="mt-1 rounded-md border border-hairline bg-sunken px-3 py-2 text-md text-ink">
                {option.text}
              </blockquote>
            ) : null}

            {option.provenance ? (
              <p className="mt-1 text-2xs text-ink-muted">{option.provenance}</p>
            ) : null}

            {option.pending ? null : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className={ACTION_CLASS}
                  onClick={() => onAccept(option)}
                >
                  {option.actionLabel}
                </button>
                {/* Keeping your own wording is offered once, beside the first
                    remedy, and it is the same button as accepting it. */}
                {index === 0 ? (
                  <button
                    type="button"
                    className={ACTION_CLASS}
                    onClick={onKeep}
                  >
                    {COPY.keep}
                  </button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Stays visible. It is what distinguishes this from a keyword filter in a
          viewer's mind (§7), and muted ink on this raised surface is the one
          pairing tokens.css measured for it. */}
      <p className="mt-4 text-2xs text-ink-muted">
        {prefix} · <span className="font-mono">{detail}</span>
      </p>
    </section>
  );
}
