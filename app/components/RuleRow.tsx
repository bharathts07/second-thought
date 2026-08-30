"use client";

/**
 * One rule, as a row that shows plain-language intent first.
 *
 * Reframed for a non-technical reader. By default, a rule shows only:
 * - Its title (what you might promise)
 * - Why it matters (the risk)
 * - Where it applies (in words a person uses)
 * - An on/off control
 *
 * Behind a "How this rule works" disclosure, for the curious: the example
 * phrasings the rule is measured against, the words that must be present, and an
 * honest statement that accuracy has not been measured yet.
 *
 * The enable control is a native checkbox: product register bans reinventing a
 * standard affordance. The expanded region is spacing, a hairline, and a
 * definition list, not a second card. A card inside a card is always wrong.
 */

import { useId, type ReactNode } from "react";
import type { PolicyRule, RecipientKind } from "@/app/lib/types";
import { SeverityChip } from "./SeverityChip";

/** Copy deck for the reframed row. */
const COPY = {
  howItWorks: "How this rule works",
  examples: "Example phrasings",
  wordsThatMatter: "Words that must be present",
  accuracyNote:
    "Accuracy for this rule has not been measured yet. The check is running, but no precision figure exists.",
  /** The checkbox's accessible name. Says which rule, so the row is not needed for context. */
  enableLabel: (title: string) => `Check drafts against: ${title}`,
} as const;

/**
 * Plain-language descriptions of where a rule applies. Written for a
 * non-technical reader: "messages to people outside your company" rather than
 * "external-guest, external-domain".
 */
function contextDescription(rule: PolicyRule): string {
  const hasInternal = rule.appliesTo.includes("internal");
  const hasExternal =
    rule.appliesTo.includes("external-guest") || rule.appliesTo.includes("external-domain");

  if (hasInternal && hasExternal) {
    return "All messages";
  } else if (hasExternal) {
    return "Messages to people outside your company";
  } else if (hasInternal) {
    return "Internal team messages";
  }
  return "No contexts";
}

/** Stable and URL-safe enough for a fragment. A personal id carries a colon. */
export function ruleRowId(id: string): string {
  return `rule-${id}`;
}

/**
 * One label/value pair in the disclosure. Stacked at narrow widths, two columns
 * once there is room.
 */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-4 sm:gap-4">
      <dt className="text-xs font-medium text-ink-secondary">{label}</dt>
      <dd className="text-sm text-ink-secondary sm:col-span-3">{children}</dd>
    </div>
  );
}

/**
 * Words and phrases are literal strings the check compares against, so they
 * render in the mono face this system reserves for machine-exact values.
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
        {/* Checkbox left of the title: a column of ticks reads as the answer to
            "what is switched on" without scanning across each row. */}
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

        {/* The default view: title, why, where it applies. All visible without
            expansion. The whole block is a column, not a disclosure button. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="flex-1 text-base font-medium text-ink">{rule.title}</h3>
            <SeverityChip severity={rule.severity} />
          </div>
          <p className="mt-1 text-sm text-ink-secondary">{rule.why}</p>
          <p className="mt-1 text-xs text-ink-muted">{contextDescription(rule)}</p>

          {/* The disclosure control sits at the end, not wrapping the whole title.
              The visitor can read what the rule is about before deciding whether
              to see how it works. */}
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={expanded ? panelId : undefined}
            onClick={() => onExpandedChange(rule.id, !expanded)}
            className="mt-2 text-sm font-medium text-accent hover:underline"
          >
            {COPY.howItWorks}
          </button>
        </div>
      </div>

      {/* Conditional render with the system's one enter animation. */}
      {expanded ? (
        <div
          id={panelId}
          className="mt-4 animate-rise-in border-t border-hairline pl-7 pt-4"
        >
          <dl className="flex flex-col gap-3">
            {/* Example phrasings: semantic rules have exemplars, term rules show
                the terms themselves as the examples. */}
            <Field label={COPY.examples}>
              {match.kind === "semantic" ? (
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
              ) : (
                <ul className="flex flex-col gap-1">
                  {match.terms.map((term) => (
                    <li key={term} className="font-mono text-sm text-ink-secondary">
                      {term}
                    </li>
                  ))}
                </ul>
              )}
            </Field>

            {/* Words that must be present: cues for semantic, terms for exact. */}
            <Field label={COPY.wordsThatMatter}>
              {match.kind === "semantic" ? (
                <TokenList tokens={match.cues} label={COPY.wordsThatMatter} />
              ) : (
                <span className="text-sm">
                  Any of the words above{match.wholeWord ? ", as whole words only" : ""}.
                </span>
              )}
            </Field>

            {/* Accuracy note: honest and prominent. */}
            <Field label="Accuracy">
              <span className="text-sm">{COPY.accuracyNote}</span>
            </Field>
          </dl>
        </div>
      ) : null}
    </li>
  );
}
