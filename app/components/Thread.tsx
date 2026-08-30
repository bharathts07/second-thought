/**
 * The conversation surface: header, participant line, badge, message list.
 *
 * **There are TWO threads, and the recipient switcher swaps which one renders**
 * (ux-spec §3, F25). Not one thread with a toggle over it. With a single thread,
 * clicking `Internal team` left "Sam · example.com" on screen underneath a panel
 * reading "Internal conversation", and with the external conversation still
 * visible, "master switch" is the literally correct reading of what the visitor
 * sees. So the internal thread contains no `example.com` participant, no
 * `example.com` message, and no badge, and `Thread.test`-style assertions on the
 * rendered markup are what keep it that way.
 *
 * Presentational. It holds the seeded content and knows nothing about the engine,
 * which is also what lets the seeded data be asserted on in a Node test without
 * pulling a worker into scope.
 *
 * `example.com` is reserved by IANA for documentation and cannot be registered,
 * so it cannot collide with a real company. Never invent a company name.
 */

import type { RecipientKind } from "@/app/lib/types";

/** Which of the two conversations is on screen. Two, not three: see RecipientSwitch. */
export type ThreadMode = "internal" | "external";

export type Message = {
  id: string;
  from: string;
  /** The role or domain label beside the name. Absent on the visitor's own messages. */
  label?: string;
  time: string;
  text: string;
  /** The visitor's own sent message, which reads as theirs rather than as a participant's. */
  mine?: boolean;
};

export type ThreadData = {
  title: string;
  participants: string;
  /** §14 `badge.external`. Absent on the internal thread, which has no badge at all. */
  badge?: string;
  /** What the engine scopes rules to when this thread is on screen. */
  recipientKind: RecipientKind;
  /** Who the reply goes to, for the engine's `Recipient.label`. */
  recipientLabel: string;
  recipientDomain?: string;
  messages: Message[];
};

/**
 * Thread A. The third message supplies time pressure, which is the actual
 * mechanism by which people over-promise: it makes the visitor want to answer
 * decisively, which is exactly the behaviour the product catches.
 */
export const THREAD_EXTERNAL: ThreadData = {
  title: "Q3 evaluation",
  participants: "You, Priya (your team), Sam (example.com)",
  badge: "External · example.com",
  recipientKind: "external-domain",
  recipientLabel: "Sam",
  recipientDomain: "example.com",
  messages: [
    {
      id: "ext-1",
      from: "Sam",
      label: "example.com",
      time: "10:02",
      text:
        "Thanks for the walkthrough yesterday. Security had one question before we sign: " +
        "can you confirm our data stays inside the US?",
    },
    {
      id: "ext-2",
      from: "Priya",
      label: "your team",
      time: "10:04",
      text: "Let me bring in the right person on that.",
    },
    {
      id: "ext-3",
      from: "Sam",
      label: "example.com",
      time: "10:11",
      text: "No rush, but we do need it in writing before Thursday.",
    },
  ],
};

/**
 * Thread B exists to make the internal state *legible*, and it gives the tone and
 * language rules somewhere real to fire. A visitor can type a harsh reply to
 * Priya and see a card, then type the residency promise and see silence, which
 * demonstrates per-rule scoping better than any copy could.
 */
export const THREAD_INTERNAL: ThreadData = {
  title: "Platform team",
  participants: "You, Priya (your team)",
  recipientKind: "internal",
  recipientLabel: "Priya",
  messages: [
    {
      id: "int-1",
      from: "Priya",
      label: "your team",
      time: "09:41",
      text: "I've pushed the revised migration plan, have a look when you get a chance.",
    },
    {
      id: "int-2",
      from: "Priya",
      label: "your team",
      time: "09:52",
      text: "Also, do you have a view on the rollout order?",
    },
  ],
};

export const SEEDED_THREADS: Record<ThreadMode, ThreadData> = {
  external: THREAD_EXTERNAL,
  internal: THREAD_INTERNAL,
};

/** §14 copy deck. Transcribed, never composed. */
const COPY = {
  reset: "Reset conversation",
} as const;

/**
 * The badge is a labelled chip in the header rather than a coloured banner
 * (T3.3.2): the external state has to be readable across a room while staying
 * calm. The accent marks it, never a severity colour, so a visitor never has to
 * wonder whether the recipient is itself a problem.
 */
function Badge({ text }: { text: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-hairline bg-accent-quiet px-2 py-1 text-xs font-medium text-accent-strong">
      {text}
    </span>
  );
}

export function Thread({
  thread,
  onReset,
  children,
}: {
  thread: ThreadData;
  onReset: () => void;
  /** The recipient switcher, which belongs inside the header per §2's wireframe. */
  children?: React.ReactNode;
}) {
  const messages = thread.messages;

  return (
    <section
      aria-label={thread.title}
      className="rounded-lg border border-hairline bg-surface"
    >
      <header className="border-b border-hairline px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            {thread.title}
          </h2>
          {thread.badge ? <Badge text={thread.badge} /> : null}
        </div>
        <p className="mt-1 text-xs text-ink-muted">{thread.participants}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          {children}
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-1 py-1 text-xs text-ink-secondary underline transition-quiet hover:text-ink"
          >
            {COPY.reset}
          </button>
        </div>
      </header>

      {/* §11: at ~390px the thread collapses to the most recent two messages.
          Hiding the earlier ones in CSS keeps one message list rather than two
          that could disagree about what was sent. */}
      <ol className="flex flex-col gap-4 px-4 py-4 sm:px-5">
        {messages.map((message, index) => (
          <li
            key={message.id}
            className={index < messages.length - 2 ? "hidden sm:block" : undefined}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-xs font-medium text-ink-secondary">
                {message.from}
                {message.label ? (
                  <span className="font-regular text-ink-muted"> · {message.label}</span>
                ) : null}
              </p>
              <time className="shrink-0 font-mono text-2xs text-ink-muted">
                {message.time}
              </time>
            </div>
            <p
              className={`mt-1 text-base ${
                message.mine ? "text-ink" : "text-ink-secondary"
              }`}
            >
              {message.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
