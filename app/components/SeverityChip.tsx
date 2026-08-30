/**
 * Severity, as a chip, plus the class names for the border that goes with it.
 *
 * This module is the whole severity treatment in one place, because the old one
 * was in two: a chip here and a 2px coloured left stripe on the card. The stripe
 * is banned. A coloured side rule on a card or callout reads as template rather
 * than as intent, and it also lies about the structure, since it decorates one
 * edge of a surface whose whole job is to look like one object attached to the
 * draft above it.
 *
 * What replaces it is deliberately duller and much better: a FULL hairline border
 * around the guidance surface, tinted toward the severity hue at very low chroma
 * (`--severity-*-edge`, around 2:1 against the surfaces it sits on). A full border
 * is the shape of a thing. A stripe is a label stuck on its side.
 *
 * Two rules are enforced by construction here.
 *
 * Severity is NEVER carried by colour alone: the chip always renders a text
 * label, so the meaning survives forced-colours mode (where globals.css collapses
 * every `-quiet` fill to `Canvas` and the fill stops existing) and it survives
 * colour blindness for free.
 *
 * And severity appears at small sizes only. The chip is 11px with a tinted fill;
 * the border is 1px. There is no filled severity panel and there is no token for
 * one, because a filled coloured container is the single thing most likely to make
 * this product read as a scold, and the visitor has not done anything wrong yet.
 */

import type { Severity } from "@/app/lib/types";

/**
 * The label is capitalised because it reads as a rank next to `Worth a second
 * thought`, and none of the three words appear on the banned list in the copy
 * deck: no `warning`, no `alert`, no `error`, no `risk score`.
 */
const SEVERITY_LABEL: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function severityLabel(severity: Severity): string {
  return SEVERITY_LABEL[severity];
}

/**
 * Written out per severity rather than composed from a string, because Tailwind
 * scans source text for class names and a template literal produces classes it
 * cannot see. Every map in this file is written out for that reason.
 */
const CHIP_TONE: Record<Severity, string> = {
  high: "bg-severity-high-quiet text-severity-high border-severity-high-edge",
  medium:
    "bg-severity-medium-quiet text-severity-medium border-severity-medium-edge",
  low: "bg-severity-low-quiet text-severity-low border-severity-low-edge",
};

/**
 * The border on the guidance surface, exported so the surface and its chip cannot
 * drift apart, and so the literal class names live in a file Tailwind already
 * scans. Use it as the FULL border:
 *
 *     `border ${severityEdge(severity)}`
 *
 * Never `border-l-2`. That was the old treatment and it is a defect now.
 */
const SEVERITY_EDGE: Record<Severity, string> = {
  high: "border-severity-high-edge",
  medium: "border-severity-medium-edge",
  low: "border-severity-low-edge",
};

export function severityEdge(severity: Severity): string {
  return SEVERITY_EDGE[severity];
}

/**
 * The wash behind a flagged span in the draft, exported for the same reason. A
 * soft tint rather than an underline: a squiggle in red says you got it wrong, and
 * nothing here has gone wrong. Ink on a wash stays `--text-primary`, which reads
 * 13:1 light and 11:1 dark on all three.
 */
const SEVERITY_WASH: Record<Severity, string> = {
  high: "bg-severity-high-wash",
  medium: "bg-severity-medium-wash",
  low: "bg-severity-low-wash",
};

export function severityWash(severity: Severity): string {
  return SEVERITY_WASH[severity];
}

/**
 * The hairline is what makes this read as a chip rather than as tinted words.
 *
 * The `-quiet` fills sit near 1.02:1 against the surface they are placed on, which
 * is deliberate (a legible severity fill at this size would be the loud read the
 * whole product avoids) but it means the fill alone gives the chip no edge. The
 * border gives it one, in the same tinted `-edge` colour the guidance surface
 * uses, so the chip reads as a piece of that surface rather than as a sticker on
 * it. It is also what keeps the chip shaped in forced-colours mode, where the fill
 * collapses to `Canvas` and the edge falls back to `CanvasText`.
 *
 * Not uppercased, though an 11px tracked label is the obvious move. `High` next to
 * `Worth a second thought` is a rank, and a rank set in capitals starts to look
 * like the thing shouting at you.
 *
 * Padding is 8px/2px rather than 8px/4px: at 11px with 16px leading, 4px of
 * vertical padding makes the chip as tall as a small button, and a chip that looks
 * pressable in a row that has two real buttons in it is a lie about what it does.
 */
const CHIP_BASE =
  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 " +
  "text-2xs font-medium tracking-label";

export function SeverityChip({
  severity,
  className = "",
}: {
  severity: Severity;
  /** Placement only. Never colour: the tone is decided above, per severity. */
  className?: string;
}) {
  return (
    <span className={`${CHIP_BASE} ${CHIP_TONE[severity]} ${className}`.trim()}>
      {severityLabel(severity)}
    </span>
  );
}
