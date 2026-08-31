/**
 * Mechanism marks: small drawings showing HOW the product works, not symbolizing
 * what it is. Hairline rules and annotation ink only, no fills, no icon set.
 *
 * Each is decorative given the sentence beside it already says the words, so all
 * are aria-hidden.
 */

/**
 * Move 1: "It reads the draft as you type"
 * Shows a line of text with a caret sitting mid-sentence.
 */
export function ReadingMark() {
  return (
    <svg
      width="48"
      height="32"
      viewBox="0 0 48 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Text line */}
      <line
        x1="4"
        y1="16"
        x2="28"
        y2="16"
        stroke="currentColor"
        strokeWidth="1"
        className="text-ink"
      />
      {/* Caret */}
      <line
        x1="32"
        y1="10"
        x2="32"
        y2="22"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-accent"
      />
    </svg>
  );
}

/**
 * Move 2: "It puts the note under the sentence"
 * Shows a line, with a hairline dropping from it to a small note block beneath,
 * which is the product's actual shape.
 */
export function NoteMark() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Draft line */}
      <rect
        x="4"
        y="6"
        width="40"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        className="text-ink"
      />
      {/* Hairline connecting to note */}
      <line
        x1="24"
        y1="16"
        x2="24"
        y2="26"
        stroke="currentColor"
        strokeWidth="1"
        className="text-accent"
      />
      {/* Note block */}
      <rect
        x="8"
        y="26"
        width="32"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        className="text-accent"
      />
    </svg>
  );
}

/**
 * Move 3: "You decide"
 * Shows two equal marks side by side, neither emphasised.
 */
export function ChoiceMark() {
  return (
    <svg
      width="48"
      height="32"
      viewBox="0 0 48 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      {/* Left choice */}
      <rect
        x="4"
        y="10"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        className="text-ink"
      />
      {/* Right choice */}
      <rect
        x="26"
        y="10"
        width="18"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1"
        className="text-ink"
      />
    </svg>
  );
}
