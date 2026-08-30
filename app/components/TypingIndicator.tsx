/**
 * Three dots, while the other person writes back.
 *
 * It exists because the pause has to be real. The client asked that the
 * conversation continue after a send, and a reply that lands instantly reads as a
 * canned reply, which it currently is. The indicator is what buys the delay in
 * `replies.ts` and makes it read as somebody typing rather than as a stalled page.
 *
 * Two decisions worth naming:
 *
 *   - **`animate-typing-dot`, which is the product's own loop token.** It is
 *     opacity only, so nothing moves, and `globals.css` already stops it under
 *     `prefers-reduced-motion` alongside the skeleton loop. Tailwind's built-in
 *     `animate-pulse` was wrong here twice over: it is not the declared token, and
 *     it is not covered by that media query, so the dots would have gone on
 *     pulsing for a visitor who asked for less motion. The stagger comes from three
 *     `animation-delay` values, which is the one inline style in this component
 *     because a per-dot delay has no utility and three near-identical classes
 *     would be worse.
 *   - **It is not a spinner.** A spinner parked in content says only that
 *     something is happening. This says a specific thing is happening: a person is
 *     answering you.
 *
 * The dots are `aria-hidden` and the sentence beside them is not, so assistive
 * technology gets words rather than a description of an ornament.
 */

/**
 * Not in the §14 deck, which has no key for a counterparty reply because the
 * conversation did not continue when it was written. Checked against §14's banned
 * list: no error, no warning, no alert, no blocked, no accusation of anyone.
 */
const COPY = {
  typing: (from: string) => `${from} is typing`,
} as const;

/** The three dots, at 120ms apart, which is close enough to read as one gesture. */
const DELAYS = ["0ms", "160ms", "320ms"] as const;

export function TypingIndicator({ from }: { from: string }) {
  return (
    <div className="animate-rise-in mt-6 flex items-center gap-2">
      <p className="text-xs font-medium text-ink-secondary">{from}</p>
      <span aria-hidden="true" className="flex items-center gap-1 pb-px">
        {DELAYS.map((delay) => (
          <span
            key={delay}
            className="animate-typing-dot size-1.5 rounded-full bg-ink-muted"
            style={{ animationDelay: delay }}
          />
        ))}
      </span>
      {/* The words, for anyone who cannot see the dots. */}
      <span className="sr-only">{COPY.typing(from)}</span>
    </div>
  );
}
