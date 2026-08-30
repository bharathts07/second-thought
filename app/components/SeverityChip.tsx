/**
 * Severity, as a chip.
 *
 * Two rules from `ux-spec` §10 and T3.6.1 are enforced by construction here.
 *
 * Severity is NEVER carried by colour alone: the chip always renders a text
 * label, so the meaning survives forced-colours mode (where tokens.css collapses
 * every `-quiet` fill to `Canvas` and the fill stops existing) and it survives
 * colour blindness for free.
 *
 * The chip is the ONLY place a severity fill appears on the card, at 11px, and
 * the ink on it is `--severity-*-text` rather than `--text-muted`. That is not a
 * taste call: tokens.css measured muted ink on every tinted fill in this system
 * and it fails 4.5:1 in the dark scheme on all of them. Muted ink belongs on the
 * provenance line's raised surface and nowhere else.
 */

import type { Severity } from "@/app/lib/types";

/**
 * The label is capitalised because it reads as a rank in the card's top rule,
 * next to `Worth a second thought`, and none of the three words are banned by
 * §14: no `warning`, no `alert`, no `error`.
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
 * cannot see.
 */
const CHIP_TONE: Record<Severity, string> = {
  high: "bg-severity-high-quiet text-severity-high",
  medium: "bg-severity-medium-quiet text-severity-medium",
  low: "bg-severity-low-quiet text-severity-low",
};

/**
 * The hairline is what makes this read as a chip rather than as tinted words.
 *
 * The `-quiet` fills sit around 1.03:1 against the card they are placed on, which
 * is deliberate (a legible severity fill at this size would be the loud read the
 * whole product avoids) but it means the fill alone gives the chip no edge. A 1px
 * neutral boundary gives it one without adding colour, and it is also what keeps
 * the chip shaped in forced-colours mode, where the fill collapses to `Canvas`.
 *
 * Not uppercased, though a 11px tracked label is the obvious move. `High` next to
 * `Worth a second thought` is a rank, and a rank set in capitals starts to look
 * like the thing shouting at you.
 */
const CHIP_BASE =
  "inline-flex shrink-0 items-center rounded-full border border-hairline px-2 py-1 " +
  "text-2xs font-medium tracking-label";

export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span className={`${CHIP_BASE} ${CHIP_TONE[severity]}`}>
      {severityLabel(severity)}
    </span>
  );
}
