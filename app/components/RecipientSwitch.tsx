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
 * The selected state is a single indicator that SLIDES, not a fill that moves
 * between two buttons.
 *
 * That is the whole difference between a control that feels like an object and two
 * buttons that take turns being tinted. This is the product's central gesture
 * (§8.4) and it is the one place in the interface where something is meant to feel
 * physical, so the indicator is one element that transitions its transform while
 * the labels stay put. `--duration-slow`, 180ms, rather than the 140ms everything
 * else uses: it is travelling a real distance, and at 140ms it arrives before the
 * eye has followed it.
 *
 * Reduced motion drops the transform from the transition, so the indicator is
 * simply already there. Nothing about the state is lost.
 *
 * The indicator is rendered BEFORE the labels and both are positioned, so the
 * labels paint over it in document order with no z-index anywhere.
 *
 * Selected and unselected are written out rather than composed, because Tailwind
 * scans source text for class names and a template literal produces classes it
 * cannot see.
 */
/**
 * `px-2` until there is room for `px-3`, which buys 16px across the track at
 * ~390px. `Shared with example.com` is a long label for half of a narrow screen,
 * and this is the difference between one line and two on the common phone widths.
 * Two lines is still a correct rendering rather than a broken one: the indicator is
 * inset from the track's top and bottom rather than given a height, so it grows
 * with the segments and stays exactly half the track wide.
 */
const SEGMENT_BASE =
  "relative rounded-full px-2 py-2 text-center text-xs font-medium transition-control sm:px-3";
const SEGMENT_ON = "text-accent-strong";
const SEGMENT_OFF = "text-ink-secondary hover:text-ink";

/**
 * The 1px `--accent` border is not decoration. tokens.css measures
 * `--accent-quiet` at 1.02:1 against the track it slides in, so the fill alone
 * cannot carry the selected state; with the border the boundary reads at 4.71
 * light and 7.12 dark, which clears the 3:1 that 1.4.11 asks of a control's state.
 */
const INDICATOR =
  "segment-indicator rounded-full border border-accent bg-accent-quiet " +
  "transition-quiet duration-slow";

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
      /* Two equal columns, at every width. §11 asks for two full-width segments at
         ~390px, and equal columns are also what lets the indicator be exactly half
         the track: a flex track sized by two labels of different lengths could not
         have one. */
      className="relative grid w-full grid-cols-2 rounded-full border border-hairline bg-sunken p-1 sm:w-auto"
    >
      {/* Decorative: the label says which segment is chosen and `aria-checked`
          says it to assistive technology, so announcing this too would be noise. */}
      <span
        aria-hidden="true"
        className={`${INDICATOR} ${mode === "external" ? "translate-x-full" : "translate-x-0"}`}
      />

      {SEGMENTS.map((segment) => {
        const selected = segment.mode === mode;
        return (
          <button
            key={segment.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            /**
             * Roving tabindex and arrow keys, which the radiogroup pattern expects
             * and this control was missing.
             *
             * Tab-then-Enter already worked, so it was never a keyboard trap. But a
             * radiogroup is meant to be ONE tab stop whose selection moves with the
             * arrows, and someone who has learned that pattern reaches for keys the
             * control ignored. This is the product's central gesture, so being
             * complete here is worth the few lines.
             */
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"].includes(event.key)) {
                return;
              }
              event.preventDefault();
              // Two segments, so any arrow moves to the other one.
              const next = SEGMENTS.find((s) => s.mode !== mode);
              if (!next) return;
              onChange(next.mode);
              // Selection follows focus in this pattern, so focus moves with it.
              const others = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                '[role="radio"]',
              );
              Array.from(others ?? [])
                .find((b) => b !== event.currentTarget)
                ?.focus();
            }}
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
