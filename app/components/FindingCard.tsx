"use client";

/**
 * The guidance card. `plan/03` T3.2 calls it the product, and every decision
 * below is one sentence of the product's argument expressed in markup.
 *
 * The moment this card exists in is an INTERRUPTION, and the target is
 * noticeable in peripheral vision, calm on inspection, and never implying the
 * visitor did something wrong. They have not sent anything yet. So:
 *
 *   - **It is no longer a card.** It is the lower zone of the pending draft's
 *     surface, and it carries no border, no corner radius and no elevation of its
 *     own, because a bordered card inside the bordered draft it describes is a
 *     nested card, which is banned and which is what made the old layout read as
 *     unfinished. `PendingDraft` owns the box; this owns what the box says.
 *   - **Severity is carried by the chip and by the surrounding surface's tinted
 *     hairline, never by a coloured side stripe and never by a fill.** The 2px
 *     left rule this card used to draw is superseded: a coloured stripe on a card
 *     signals template rather than intent, and a filled severity panel reads as a
 *     scold when nothing has been sent.
 *   - `Use this` and `Keep mine` share one class constant, so they cannot drift
 *     apart into a primary button and a muted link. The moment one wins, the
 *     product is instructing rather than informing (T3.2.4, §7).
 *   - Every string comes from the §14 copy deck, checked against its banned list:
 *     no violation, breach, error, warning, alert, blocked, you must.
 *   - **Every finding offers the way to its own rule.** Somebody who has just been
 *     flagged is at the one moment they actually want to know what a rule is, so
 *     the provenance line ends in a link to `/settings#rule-<id>`, which that page
 *     already expands and scrolls to.
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

import Link from "next/link";
import { useId } from "react";
import type { Finding } from "@/app/lib/types";
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
  editRule: "Edit this rule",
} as const;

/**
 * The fragment `/settings` listens for. Built here rather than imported from
 * `RuleRow` so this file keeps importing types and nothing else, but it has to stay
 * in step with `ruleRowId`, which is the one thing that would break the deep link
 * silently.
 */
export function ruleHref(ruleId: string): string {
  return `/settings#rule-${ruleId}`;
}

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
 * No box, no radius, no elevation, no padding: all four belong to `PendingDraft`,
 * which is the surface this is part of. What is left is the background, which is
 * the SAME token the surface uses, so the two zones are one continuous fill rather
 * than a card sitting inside a card.
 *
 * `animate-rise-in` is the 140ms fade-and-rise from globals.css, and it is the only
 * flourish this product spends anywhere, because this is the moment the product
 * exists for. Reduced motion flattens it to a fade.
 */
const CARD_BASE = "animate-rise-in bg-raised";

/**
 * The 11px label register, used for every small label on this card without
 * exception: the eyebrow, the section headings over each remedy, and the
 * provenance line. Medium weight, +0.04em, secondary or muted ink, never
 * capitalised. Capitals at this size read as a system announcing something, and
 * an announcement is the register the card is built to avoid.
 */
const LABEL_CLASS = "text-2xs font-medium tracking-label";

/**
 * One class constant, used by both actions. This is T3.2.4 in the only form that
 * cannot rot: there is no second button style in this file to promote one to.
 * Full width on narrow screens per §11, auto once there is room.
 *
 * `transition-control` rather than `transition-quiet`: the hover changes a
 * background, and `transition-quiet` animates opacity and movement only, so the
 * hover this button has always declared has never actually transitioned.
 *
 * The hover deliberately does not touch the border. `--border-edge` is a lighter
 * line than `--border-control`, so brightening the boundary on hover would drop it
 * under the 3:1 that 1.4.11 asks of a control's edge; the background carries the
 * state instead.
 */
const ACTION_CLASS =
  "w-full sm:w-auto rounded-md border border-control bg-surface px-4 py-2 " +
  "text-sm font-medium text-ink transition-control hover:bg-sunken";

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
    <section aria-labelledby={titleId} className={CARD_BASE}>
      {/* The eyebrow and the severity word, in the top edge of the guidance zone.
          There is no hairline under them any more: the seam that separates this zone
          from the draft above it is 16px higher, and a second rule directly beneath
          the first would be the noise that makes a surface look busy rather than
          structured. */}
      <div className="flex items-center justify-between gap-3">
        <p className={`${LABEL_CLASS} text-ink-muted`}>{COPY.heading}</p>
        <SeverityChip severity={finding.severity} />
      </div>

      {/*
        Title first, reason second, wording third, actions last (T3.2.3), and the
        spacing is what makes that an order rather than a sequence. Tightened from
        the previous 4-16-24 progression to reduce the guidance surface height while
        preserving hierarchy: 3-12-16 keeps the relationships clear at a smaller
        overall scale.

        `tracking-heading` is -0.006em, for 18px. The 22px `tracking-tight` this
        used is enough to look squeezed at this size.
      */}
      <h3 id={titleId} className="mt-3 text-lg font-semibold tracking-heading text-ink">
        {finding.title}
      </h3>

      <p className="mt-1 max-w-reading text-md text-ink-secondary">{finding.why}</p>

      {/* Quoted inside the card, so a non-visual visitor never has to go and
          find an underline in the composer (§10).
          A hairline rule and no fill, for two reasons. tokens.css licenses the
          severity `-wash` for the flagged span in the composer and nowhere else,
          and the filled surface in this card belongs to the SUGGESTION, which
          T3.2.3 wants visually distinct from the visitor's own sentence. */}
      <blockquote className="mt-3 max-w-reading border-l border-l-hairline pl-4 text-base text-ink-secondary">
        &ldquo;{finding.matchedText}&rdquo;
      </blockquote>

      <ul className="mt-4 flex flex-col gap-4">
        {options.map((option, index) => (
          <li key={option.id}>
            {option.heading ? (
              <p className={`${LABEL_CLASS} text-ink-secondary`}>{option.heading}</p>
            ) : null}

            {/* A quotation with its own sunken surface, never an editable field
                (T3.2.5). It is a suggestion to accept, not a form to fill in.
                Primary ink at 16px on a sunken fill: this is the one sentence on
                the card the visitor is being offered, so it is the most legible
                thing on it after the title. */}
            {option.pending ? (
              <p className="mt-2 text-sm text-ink-muted">{COPY.preparing}</p>
            ) : option.text ? (
              /* A fill and no border. The border made this read as a box inside a
                 box now that the whole guidance zone sits inside the draft's own
                 surface, and the fill alone is enough to say this sentence is the
                 offer rather than the visitor's own words. */
              <blockquote className="mt-2 max-w-reading rounded-md bg-sunken px-4 py-3 text-md text-ink">
                {option.text}
              </blockquote>
            ) : null}

            {option.provenance ? (
              <p className={`mt-1 ${LABEL_CLASS} text-ink-muted`}>{option.provenance}</p>
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
          pairing tokens.css measured for it: 6.02 light · 5.09 dark, the worst case
          in the system and still clear of 4.5:1.

          A hairline above it, because this line is a different kind of statement
          from everything over it: the card's argument is for the visitor, and this
          is the machine showing its working. `tabular-nums` so the score's digits
          are the same width, which is the difference between a number that looks
          measured and one that looks typed. */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-hairline pt-3">
        <p className={`${LABEL_CLASS} text-ink-muted`}>
          {prefix} · <span className="font-mono tabular-nums">{detail}</span>
        </p>

        {/*
          The answer to "what is a rule, and where do I see it", offered at the one
          moment the question has a referent. An anchor rather than a button, because
          it is navigation and because the two actions above must remain the only
          buttons on this card: the instant a third appears, `Use this` and
          `Keep mine` stop being the obvious pair of equals.
        */}
        <Link
          href={ruleHref(finding.ruleId)}
          className={`${LABEL_CLASS} shrink-0 rounded-sm text-ink-muted underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control`}
        >
          {COPY.editRule}
        </Link>
      </div>
    </section>
  );
}
