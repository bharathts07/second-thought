/**
 * The draft, as a message that has not been sent, with its guidance hanging off it.
 *
 * This is the change the client asked for and the one the product turns on.
 * Guidance used to sit in a region below the composer, which meant the visitor had
 * to infer that a card was about the sentence they were writing. Here the
 * relationship is structural: the draft renders as a message at the end of the
 * thread, and the guidance is the lower half of the same object.
 *
 * **One surface, not a card inside a card.** One border, one background, one
 * elevation, and a hairline seam between the two zones. The alternative, a
 * bordered guidance card sitting inside a bordered draft card, is banned outright,
 * and it is also the thing that made the old layout read as unfinished.
 *
 * **It must be obvious this has not been sent**, because that distinction is the
 * difference between advice and a record, and the whole product rests on arriving
 * before the record exists. Three things carry it: the label sits in the slot where
 * every sent message shows a timestamp and says so in words, the surface is lifted
 * and outlined where a sent message is plain text on the thread, and it vanishes
 * the instant Send is pressed, reappearing above as an ordinary message with a
 * time.
 *
 * **Severity is a full hairline border, tinted.** Not a coloured side stripe, which
 * is banned, and not a filled panel, which reads as a scold when the visitor has
 * not done anything wrong yet. A full border is structural where a stripe is
 * decorative, and it also happens to be the only treatment that can wrap two zones
 * and still say they are one object.
 */

import type { Severity } from "@/app/lib/types";

/**
 * Not in the §14 deck, which predates the pending bubble. Checked against §14's
 * banned list: it accuses nobody and claims nothing about the product.
 */
const COPY = {
  author: "You",
  pending: "Not sent yet",
} as const;

/**
 * Written out per severity rather than composed, because Tailwind reads source
 * text and cannot see a class built from a template literal.
 *
 * `border-edge` is the no-guidance case: `--border-strong`, a neutral, so a draft
 * with nothing to say about it still reads as an object rather than dissolving into
 * the thread behind it.
 *
 * The `-edge` names, not the `-border` ones: `globals.css` documents `-border` as a
 * retired alias of the banned 2px left stripe, kept only so nothing breaks
 * mid-flight, and `SeverityChip` already reaches for `-edge`. Both resolve to the
 * same colour today, so this is the name surviving a cleanup rather than a change
 * on screen.
 */
const SURFACE_EDGE: Record<Severity, string> = {
  high: "border-severity-high-edge",
  medium: "border-severity-medium-edge",
  low: "border-severity-low-edge",
};

/**
 * The seam takes the same tint as the box, at the same 1px. A neutral divider
 * inside a tinted box reads as two objects that happen to touch, which is the read
 * this component exists to avoid.
 */
const SEAM_EDGE: Record<Severity, string> = {
  high: "border-t-severity-high-edge",
  medium: "border-t-severity-medium-edge",
  low: "border-t-severity-low-edge",
};

type PendingDraftProps = {
  draft: string;
  /**
   * The highest severity on screen, or undefined when there is no guidance. It
   * decides the tint of the surrounding border and nothing else: the severity WORD
   * is carried by the chip on each card, so colour is never the only carrier.
   */
  severity?: Severity;
  /**
   * Whether the lower zone has anything in it. Separate from `children` because the
   * guidance node is always mounted even when empty: it owns the polite live
   * region, and a live region that mounts at the same moment as its first content
   * is not reliably announced. Empty, the zone carries no seam and no padding, so
   * it costs nothing on screen while still being in the tree.
   */
  hasGuidance: boolean;
  children?: React.ReactNode;
};

export function PendingDraft({
  draft,
  severity,
  hasGuidance,
  children,
}: PendingDraftProps) {
  const edge = severity ? SURFACE_EDGE[severity] : "border-edge";
  const seam = severity ? SEAM_EDGE[severity] : "border-t-hairline";

  return (
    <div
      className={`animate-rise-in mt-6 overflow-hidden rounded-lg border bg-raised shadow-raised transition-control ${edge}`}
    >
      {/*
        The same meta-then-body shape as a message in the thread above, at the same
        sizes, which is what makes this read as a message rather than as a preview
        pane. The label register is the 11px tracked one used for every small label
        in this product.
      */}
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs font-medium text-ink">{COPY.author}</p>
          <p className="shrink-0 text-2xs font-medium tracking-label text-ink-muted">
            {COPY.pending}
          </p>
        </div>
        {/* `whitespace-pre-wrap`: the visitor's own line breaks are part of what
            they wrote, and a bubble that silently reflows them is a bubble that
            does not show what will actually be sent. */}
        <p className="mt-1 max-w-reading whitespace-pre-wrap text-base text-ink">
          {draft}
        </p>
      </div>

      <div className={hasGuidance ? `border-t px-4 py-4 sm:px-5 ${seam}` : ""}>
        {children}
      </div>
    </div>
  );
}
