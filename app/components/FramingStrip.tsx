"use client";

/**
 * The first five seconds.
 *
 * A client review found that a new visitor could not tell what this page was for,
 * and could not tell what a "rule" was or where the rules lived. Both are answered
 * here rather than in a tour or on a separate landing page: this is an empty state
 * that teaches the interface, sitting directly above the conversation it is
 * talking about.
 *
 * **It collapses after the first interaction and does not come back on its own.**
 * A framing strip that survives every keystroke stops being framing and becomes a
 * banner, and a banner is the thing every visitor learns to look past. What
 * survives the collapse is the one line that stays useful after the product has
 * been understood: the way to the rules.
 *
 * Why the rules pointer is worded and not just `Rules` in the nav: `Rules` is
 * meaningless to someone who has not seen the product fire yet. It only becomes a
 * word with a referent once guidance has appeared, which is also why every finding
 * carries its own link to the rule that produced it.
 */

import Link from "next/link";
import { useId } from "react";

/**
 * `page.subtitle` and `page.harness` are transcribed from the §14 deck. The rest
 * is new copy, because §14 predates this strip and has no key for it. Checked
 * against §14's banned list: no violation, breach, error, warning, alert, blocked,
 * prevented, forbidden, you must, you should not. Nothing here claims the product
 * prevents or ensures anything: it "says so", it "suggests".
 */
const COPY = {
  subtitle:
    "A draft check that runs in your browser. Nothing you type is sent anywhere.",
  task:
    "Answer the question in the conversation below. If your draft promises " +
    "something your company cannot promise, guidance appears under it and you can " +
    "take the suggested wording or keep your own.",
  rulesLead: "The suggestions come from your company's rules.",
  rulesLink: "See the rules it checks against",
  harness:
    "This is a demo surface built to show the checker. The intended form is a " +
    "browser extension for the tools you already use.",
  hide: "Hide",
  expand: "What is this?",
} as const;

const LINK_CLASS =
  "rounded-sm text-ink underline decoration-hairline underline-offset-2 transition-control hover:decoration-control";

const TOGGLE_CLASS =
  "shrink-0 rounded-sm text-xs text-ink-muted underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control";

export function FramingStrip({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const bodyId = useId();

  /*
   * Collapsed: one quiet line, and it is the rules pointer rather than a summary
   * of what was just dismissed. Repeating the pitch in miniature is the nag this
   * collapse exists to remove.
   */
  if (!open) {
    return (
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-hairline pb-3 text-xs text-ink-muted">
        <Link href="/settings" className={LINK_CLASS}>
          {COPY.rulesLink}
        </Link>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-controls={bodyId}
          className={TOGGLE_CLASS}
        >
          {COPY.expand}
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-hairline pb-5">
      <div className="flex items-start justify-between gap-4">
        {/* 16px on the first line and 13px under it, so the strip has a top line
            rather than three paragraphs of equal weight. Uniform size here was
            what made the old header read as boilerplate to be skipped. */}
        <p className="max-w-reading text-md text-ink">{COPY.subtitle}</p>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={true}
          aria-controls={bodyId}
          className={TOGGLE_CLASS}
        >
          {COPY.hide}
        </button>
      </div>

      <div id={bodyId} className="mt-3 flex flex-col gap-2">
        <p className="max-w-reading text-sm text-ink-secondary">{COPY.task}</p>
        <p className="max-w-reading text-sm text-ink-secondary">
          {COPY.rulesLead}{" "}
          <Link href="/settings" className={LINK_CLASS}>
            {COPY.rulesLink}
          </Link>
          .
        </p>
        <p className="max-w-reading text-xs text-ink-muted">{COPY.harness}</p>
      </div>
    </div>
  );
}
