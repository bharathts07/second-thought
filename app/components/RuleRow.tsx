"use client";

/**
 * One rule, as a row that opens to show all of it.
 *
 * `plan/10` T10.3.3 is the whole brief: a tool that inspects your writing owes
 * you the ability to read every rule it applies. So the expanded state shows the
 * `why`, the cues, the exemplars or terms, the threshold, and the contexts it
 * applies in, and it shows them as data rather than as a summary. Nothing here
 * paraphrases a rule; every value is read off the `PolicyRule` it was given.
 *
 * Three decisions worth keeping:
 *
 *   - **The enable control is a native checkbox.** A hand-built switch would need
 *     its own focus ring, its own forced-colours fallback, and its own state
 *     semantics, and the product register bans reinventing a standard affordance
 *     for flavour. `accent-accent` is the one accent colour in the system, and
 *     `color-scheme` on the root already makes the control render correctly in
 *     both schemes. The visible tick is the state; no colour-only signal.
 *   - **The threshold renders with the word `Placeholder` beside it.** No
 *     threshold in this rule set has been calibrated, so presenting 0.60 as a
 *     tuned number would be the kind of quiet overclaim `content-safety.md` §5
 *     exists to stop. Precision reads `Not evaluated` for the same reason.
 *   - **The expanded region is not a second card.** It is spacing, a hairline,
 *     and a definition list on the row's own surface. A card inside a card is
 *     always wrong, and the sunken fill in this system belongs to quoted wording.
 *
 * Strings come from `ux-spec.md` §14 where the deck has one, and from `plan/10`
 * where it does not (the deck has no labels for a rule's own fields). Every added
 * string is checked against the §14 banned list: no violation, breach, error,
 * warning, alert, blocked, you must, risk score, offence, misconduct.
 */

import { useId, type ReactNode } from "react";
import type { PolicyRule, RecipientKind, RuleCategory } from "@/app/lib/types";
import { SeverityChip } from "./SeverityChip";

/** §14 copy deck, plus the field labels the deck does not carry. */
const COPY = {
  notEvaluated: "Not evaluated",
  matchMeaning: "Match the meaning",
  matchExact: "Match exact words",
  removeTerm: "Remove it",
  why: "Why it is here",
  appliesTo: "Where it applies",
  howItMatches: "How it matches",
  cues: "Words that have to appear",
  exemplars: "Examples it is measured against",
  threshold: "Similarity threshold",
  thresholdNote: "Placeholder. Nothing in this rule set has been calibrated yet.",
  terms: "Words it looks for",
  wholeWord: "Whole words only",
  suggested: "Suggested wording",
  noSuggested: "None. The card offers to remove the word instead.",
  precision: "Measured precision",
  yes: "Yes",
  no: "No",
  /** The checkbox's accessible name. Says which rule, so the row is not needed for context. */
  enableLabel: (title: string) => `Check drafts against: ${title}`,
} as const;

/**
 * Human labels for the six categories. `disclosure` belongs to the deterministic
 * rung rather than to any rule in the shipped set, and it is listed anyway so
 * that adding such a rule cannot produce a blank cell.
 */
const CATEGORY_LABEL: Record<RuleCategory, string> = {
  claim: "Claim",
  commitment: "Commitment",
  channel: "Channel",
  disclosure: "Disclosure",
  tone: "Tone",
  language: "Language",
};

/**
 * The demo has two recipient segments and the engine has three kinds, so these
 * are the rule's own vocabulary rather than the switch's. `Internal team` is the
 * deck's `recipient.internal`; the two external labels have no deck entry.
 */
const CONTEXT_LABEL: Record<RecipientKind, string> = {
  internal: "Internal team",
  "external-guest": "External guest",
  "external-domain": "External domain",
};

/** Stable and URL-safe enough for a fragment. A personal id carries a colon. */
export function ruleRowId(id: string): string {
  return `rule-${id}`;
}

export function categoryLabel(category: RuleCategory): string {
  return CATEGORY_LABEL[category];
}

export function contextLabels(rule: PolicyRule): string[] {
  return rule.appliesTo.map((kind) => CONTEXT_LABEL[kind]);
}

export function matchModeLabel(rule: PolicyRule): string {
  return rule.match.kind === "semantic" ? COPY.matchMeaning : COPY.matchExact;
}

/**
 * One label/value pair. Stacked at 390px and two columns once there is room,
 * which keeps the label column from squeezing the values into three words a line.
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-4 sm:gap-4">
      <dt className="text-xs font-medium text-ink-secondary">{label}</dt>
      <dd className="text-sm text-ink sm:col-span-3">{children}</dd>
    </div>
  );
}

/**
 * Cues and terms are literal strings the matcher compares against, so they render
 * in the mono face this system reserves for machine-exact values. Reading them as
 * prose would invite the assumption that they are approximate.
 */
function TokenList({ tokens, label }: { tokens: readonly string[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1">
      {tokens.map((token) => (
        <li
          key={token}
          className="rounded-sm border border-hairline bg-sunken px-2 py-1 font-mono text-2xs text-ink"
        >
          {token}
        </li>
      ))}
    </ul>
  );
}

/**
 * The disclosure marker. Rotation is `motion-safe:` gated rather than relying on
 * `transition-quiet`, because Tailwind emits `rotate` as its own property and the
 * project's reduced-motion override only strips transform from that one utility.
 *
 * The DURATION carries the same gate, and it has to. `transition-property` defaults
 * to `all`, so a `duration-base` left outside the gate re-animates the rotation
 * under `prefers-reduced-motion: reduce` even though `transition-transform` is
 * correctly withheld: measured at 74deg mid-transition before this was fixed.
 */
function Caret({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className={`mt-1 size-3 shrink-0 text-ink-muted ease-out motion-safe:transition-transform motion-safe:duration-base ${
        expanded ? "rotate-90" : ""
      }`}
    >
      <path
        d="M4.5 2.5 L8 6 L4.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type RuleRowProps = {
  rule: PolicyRule;
  /** Held by the page, in component state. Nothing here is written to storage. */
  enabled: boolean;
  expanded: boolean;
  onEnabledChange: (ruleId: string, next: boolean) => void;
  onExpandedChange: (ruleId: string, next: boolean) => void;
};

export function RuleRow({
  rule,
  enabled,
  expanded,
  onEnabledChange,
  onExpandedChange,
}: RuleRowProps) {
  const checkboxId = useId();
  const panelId = useId();
  const { match } = rule;

  return (
    <li id={ruleRowId(rule.id)} className="px-4 py-3 sm:px-5">
      <div className="flex items-start gap-3">
        {/* Left of the title, so a column of ticks reads as the answer to "what is
            switched on" without anyone having to scan across each row. */}
        <input
          type="checkbox"
          id={checkboxId}
          checked={enabled}
          onChange={(event) => onEnabledChange(rule.id, event.target.checked)}
          className="mt-1 size-4 shrink-0 accent-accent"
        />
        <label htmlFor={checkboxId} className="sr-only">
          {COPY.enableLabel(rule.title)}
        </label>

        {/* The whole title block is the disclosure control, which is both a bigger
            target at 390px and the behaviour a settings list has taught everyone
            to expect. The severity chip sits inside it, so the accessible name
            carries the severity too. */}
        <button
          type="button"
          aria-expanded={expanded}
          /* Only while the panel exists. `aria-expanded` carries the state on its
             own, and pointing `aria-controls` at an id that is not in the document
             is a reference assistive technology cannot follow. */
          aria-controls={expanded ? panelId : undefined}
          onClick={() => onExpandedChange(rule.id, !expanded)}
          className="min-w-0 flex-1 text-left"
        >
          {/* The caret sits at the far end rather than beside the checkbox: two
              controls side by side at the start of a row read as one ambiguous
              cluster, and the chevron is where a settings row has always put it. */}
          <span className="flex items-start gap-2">
            <span className="flex-1 text-base font-medium text-ink">{rule.title}</span>
            <SeverityChip severity={rule.severity} />
            <Caret expanded={expanded} />
          </span>
          <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-ink-secondary">
            <span>{categoryLabel(rule.category)}</span>
            <span aria-hidden="true">·</span>
            <span>{contextLabels(rule).join(", ")}</span>
          </span>
        </button>
      </div>

      {/* Conditional render with the system's one enter animation, rather than an
          animated height. Height is a layout property and animating it here would
          also move every row below this one while it ran. */}
      {expanded ? (
        /* `pl-7` is the checkbox plus its gap, so every value in the panel starts
           on the same vertical as the rule title above it. */
        <dl id={panelId} className="mt-4 flex animate-rise-in flex-col gap-3 pb-1 pl-7">
          <Field label={COPY.why}>
            <span className="text-ink-secondary">{rule.why}</span>
          </Field>

          <Field label={COPY.appliesTo}>{contextLabels(rule).join(" · ")}</Field>

          <Field label={COPY.howItMatches}>{matchModeLabel(rule)}</Field>

          {match.kind === "semantic" ? (
            <>
              <Field label={COPY.cues}>
                <TokenList tokens={match.cues} label={COPY.cues} />
              </Field>

              <Field label={COPY.exemplars}>
                <ul className="flex flex-col gap-2">
                  {match.exemplars.map((exemplar) => (
                    <li
                      key={exemplar}
                      className="border-l border-l-hairline pl-3 text-ink-secondary"
                    >
                      &ldquo;{exemplar}&rdquo;
                    </li>
                  ))}
                </ul>
              </Field>

              <Field label={COPY.threshold}>
                <span className="font-mono">{match.threshold.toFixed(2)}</span>
                <span className="mt-1 block text-xs text-ink-muted">
                  {COPY.thresholdNote}
                </span>
              </Field>
            </>
          ) : (
            <>
              <Field label={COPY.terms}>
                <TokenList tokens={match.terms} label={COPY.terms} />
              </Field>
              <Field label={COPY.wholeWord}>
                {match.wholeWord ? COPY.yes : COPY.no}
              </Field>
            </>
          )}

          <Field label={COPY.suggested}>
            {rule.replacement ? (
              /* A quotation on its own sunken surface, the same treatment the card
                 gives it, so the wording reads as wording rather than as a field. */
              <blockquote className="rounded-md border border-hairline bg-sunken px-3 py-2 text-ink">
                {rule.replacement}
              </blockquote>
            ) : (
              <span className="text-ink-secondary">
                {COPY.noSuggested} (<span className="text-ink">{COPY.removeTerm}</span>)
              </span>
            )}
          </Field>

          {/* Never a number and never a blank: no precision figure has been
              measured for any rule in this set (T10.3.3). */}
          <Field label={COPY.precision}>
            <span className="text-ink-secondary">{COPY.notEvaluated}</span>
          </Field>
        </dl>
      ) : null}
    </li>
  );
}
