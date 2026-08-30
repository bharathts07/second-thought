"use client";

/**
 * The two-segment control that swaps which conversation is on screen.
 *
 * Two segments rather than three (T4.2.1). `external-guest` and `external-domain`
 * behave identically in this demo, so a third segment would be a distinction the
 * visitor cannot perceive and would only add doubt about which one to pick. The
 * engine keeps all three kinds because the extension needs them.
 *
 * A segmented control, never a dropdown (T4.2.4): this is the product's central
 * gesture, so the state change has to be visible in one click with no menu
 * covering the composer.
 *
 * Semantics are radio rather than two toggle buttons, because the two segments
 * are one choice with one answer. That also gives arrow-key traversal for free in
 * every screen reader's forms mode, and it makes the selected state legible
 * without relying on the accent fill, which matters in forced-colours mode where
 * tokens.css collapses `--accent-quiet` to `Canvas`.
 */

import type { ThreadMode } from "./Thread";

/** §14 copy deck. */
const COPY = {
  internal: "Internal team",
  external: "Shared with example.com",
  groupLabel: "Who this message is shared with",
} as const;

const SEGMENTS: readonly { mode: ThreadMode; label: string }[] = [
  { mode: "internal", label: COPY.internal },
  { mode: "external", label: COPY.external },
];

/**
 * Selected and unselected are written out rather than composed, because Tailwind
 * scans source text for class names and a template literal produces classes it
 * cannot see.
 */
const SEGMENT_BASE =
  "flex-1 rounded-full px-3 py-2 text-xs font-medium transition-quiet sm:flex-none";
const SEGMENT_ON = "bg-accent-quiet text-accent-strong";
const SEGMENT_OFF = "text-ink-secondary hover:text-ink";

export function RecipientSwitch({
  mode,
  onChange,
}: {
  mode: ThreadMode;
  /** Switching re-scans immediately with no debounce (§6). The container owns that. */
  onChange: (mode: ThreadMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={COPY.groupLabel}
      /* §11: two full-width segments at ~390px, auto once there is room. */
      className="flex w-full items-center gap-1 rounded-full border border-hairline bg-sunken p-1 sm:w-auto"
    >
      {SEGMENTS.map((segment) => {
        const selected = segment.mode === mode;
        return (
          <button
            key={segment.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(segment.mode)}
            className={`${SEGMENT_BASE} ${selected ? SEGMENT_ON : SEGMENT_OFF}`}
          >
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}
