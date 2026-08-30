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
 * **This strip is on a height budget, and the budget is the fold.** Open at
 * 1280x800 it used to run 254px over five stacked blocks, which pushed the field
 * the visitor is meant to type into across the fold: the draft surface ran to
 * y=845 on an 800px viewport, so the input was cut in half on a standard laptop.
 * It is 195px now and the draft surface ends at y=786, measured rather than
 * estimated. Anything added here is paid for in pixels of the product, so the
 * order to spend in is: shorten a sentence, merge two blocks into one, tighten
 * the spacing by one step. Never the lead's size, and never by moving the privacy
 * sentence behind the collapse, which would put the trust argument behind an
 * interaction and leave the strip arguing for itself instead.
 *
 * Why the rules pointer is worded and not just `Rules` in the nav: `Rules` is
 * meaningless to someone who has not seen the product fire yet. It only becomes a
 * word with a referent once guidance has appeared, which is also why every finding
 * carries its own link to the rule that produced it.
 */

import Link from "next/link";
import { useId } from "react";

/**
 * Transcribed from the specification. Checked against §14's banned list: no
 * violation, breach, error, warning, alert, blocked, prevented, forbidden, you must,
 * you should not. Nothing here claims the product prevents or ensures anything: it
 * "says so", it "suggests".
 */
const COPY = {
  lead:
    "Your company has rules about what you can promise a customer. This checks your draft against them before you send it.",
  task:
    "Answer the question below. If your draft promises more than your company can stand behind, you will see a note under it with a better way to say it.",
  privacy: "It all happens on your computer. Nothing you type is sent anywhere.",
  rulesLink: "See the rules it checks against",
  harness:
    "This is a demo of the checker. The intended form is an extension for the tools you already use.",
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
    <div className="border-b border-hairline pb-4">
      <div className="flex items-start justify-between gap-4">
        {/* 18px here against 14.2px under it, so the strip has a top LINE rather
            than four paragraphs of equal weight. Uniform size was what made the
            old header read as boilerplate to be skipped, and this line is the
            answer to "what is this", so it is the last thing that may shrink:
            when this strip had to give back 59px, every other block gave and
            this one did not. */}
        <p className="max-w-reading text-md text-ink">{COPY.lead}</p>
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

      {/* Three blocks, not five. The way to the rules rides at the end of the
          privacy sentence instead of standing as its own paragraph: it is the same
          sentence's business, and a lone one-line paragraph containing a single
          link was costing a block gap to say nothing extra. */}
      <div id={bodyId} className="mt-3 flex flex-col gap-rhythm-stack-tight">
        <p className="max-w-reading text-sm text-ink-secondary">{COPY.task}</p>
        <p className="max-w-reading text-sm text-ink-secondary">
          {COPY.privacy}{" "}
          <Link href="/settings" className={LINK_CLASS}>
            {COPY.rulesLink}
          </Link>
          .
        </p>
        {/* The one paragraph here without the reading measure, deliberately. It
            needs 556px to set on a single line and the 68ch measure hands it 541,
            so the measure was buying a second line for fifteen pixels. A measure
            protects the eye's return to the start of the NEXT line, and a line
            that does not wrap has no next line to return to. It still wraps
            normally on a narrow window, where it is prose again. */}
        <p className="text-xs text-ink-muted">{COPY.harness}</p>
      </div>
    </div>
  );
}
