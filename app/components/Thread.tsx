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
    <span className="inline-flex shrink-0 items-center rounded-full border border-hairline bg-accent-quiet px-2 py-1 text-2xs font-medium tracking-label text-accent-strong">
      {text}
    </span>
  );
}

/**
 * The message meta line, and the one typographic decision that makes this read as
 * a conversation.
 *
 * The author and the time are chrome: 11-12px, secondary and muted, the time in
 * tabular figures so `09:41` and `10:11` align down the right edge instead of
 * shuffling by a fraction of a character. The message itself is 15px at primary
 * ink over a reading measure. Before this the bodies were secondary ink and the
 * meta was the same size as them, so a thread read as a list of records rather
 * than as people talking.
 *
 * Consecutive messages from one author render the meta line once. Priya's two
 * seeded messages are the case that proves it: repeating her name directly under
 * her name is the sort of thing a real client would never ship.
 *
 * `mobileOnly` is the narrow-screen exception, and it has to be a display rule
 * rather than a different value of `showMeta` because one DOM tree serves both
 * layouts. When the row that survives the ~390px collapse is itself a
 * continuation, mobile needs the name (it is the top of the visible thread) and
 * desktop must NOT have it (the row above is the same author, still on screen).
 * Send three messages in a row and this is the case: without the `sm:hidden`,
 * `You` renders again 8px under `You` on a wide screen, which is the exact defect
 * the grouping exists to prevent.
 */
function MessageMeta({ message, mobileOnly }: { message: Message; mobileOnly?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 ${mobileOnly ? "sm:hidden" : ""}`}
    >
      <p
        className={`text-xs font-medium ${message.mine ? "text-ink" : "text-ink-secondary"}`}
      >
        {message.from}
        {message.label ? (
          <span className="font-regular text-ink-muted"> · {message.label}</span>
        ) : null}
      </p>
      <time className="shrink-0 font-mono text-2xs tabular-nums text-ink-muted">
        {message.time}
      </time>
    </div>
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
  /**
   * §11 keeps the most recent two messages at ~390px by hiding the earlier ones in
   * CSS. Which means the author line cannot be grouped away on the first message
   * that survives that: on a narrow screen it would be the top of the thread with
   * nobody's name on it. So the meta line is forced there, and where the grouping
   * disagrees it is forced for the narrow layout only (see `MessageMeta`).
   */
  const firstKeptOnMobile = messages.length - 2;

  return (
    <section
      aria-label={thread.title}
      className="rounded-lg border border-hairline bg-surface"
    >
      {/*
        A quiet channel header (T3.3.1). The title is 16px semibold rather than the
        22px it was: this is chrome, and at 22px it was the largest thing on the
        page, competing with the card that is supposed to be the loudest voice in
        the interface. Hierarchy is what an object is next to, not what it is.
      */}
      <header className="border-b border-hairline px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-md font-semibold text-ink">{thread.title}</h2>
          {thread.badge ? <Badge text={thread.badge} /> : null}
        </div>
        <p className="mt-1 text-2xs text-ink-muted">{thread.participants}</p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {children}
          <button
            type="button"
            onClick={onReset}
            className="rounded-md px-1 py-1 text-xs text-ink-muted underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control"
          >
            {COPY.reset}
          </button>
        </div>
      </header>

      {/* §11: at ~390px the thread collapses to the most recent two messages.
          Hiding the earlier ones in CSS keeps one message list rather than two
          that could disagree about what was sent.

          The rhythm is 24px between speakers and 4px between a name and what they
          said, so the gaps group the rows rather than sitting evenly and grouping
          nothing. A continuation from the same author closes to 8px, which is what
          makes two messages read as one turn. */}
      <ol className="flex flex-col px-4 py-5 sm:px-5">
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined;
          const continues = previous !== undefined && previous.from === message.from;
          const showMeta = !continues || index === firstKeptOnMobile;
          /**
           * Written out per case rather than composed, because Tailwind scans source
           * text and cannot see a class assembled from parts.
           *
           * The `mt-0 sm:` pair is for the row that is first on a narrow screen: its
           * gap separates it from a message that is hidden there, so on mobile it
           * would open 24px of space above the top of the thread.
           */
          const gap =
            index === 0
              ? ""
              : index === firstKeptOnMobile
                ? continues
                  ? "mt-0 sm:mt-2"
                  : "mt-0 sm:mt-6"
                : continues
                  ? "mt-2"
                  : "mt-6";

          return (
            <li
              key={message.id}
              className={`${index < firstKeptOnMobile ? "hidden sm:block" : ""} ${gap}`.trim()}
            >
              {showMeta ? (
                <MessageMeta message={message} mobileOnly={continues} />
              ) : null}
              {/* A reading measure, because 15px running the full width of the app
                  column is 95 characters and nobody reads that comfortably.
                  The `sm:mt-0` pair goes with the meta line that only exists on
                  mobile: the gap under it has to disappear where the line does. */}
              <p
                className={`max-w-reading text-base text-ink ${
                  showMeta ? (continues ? "mt-1 sm:mt-0" : "mt-1") : ""
                }`}
              >
                {message.text}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
