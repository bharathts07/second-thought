/**
 * The conversation surface: header, participant line, badge, message list, and the
 * two things that hang off the end of it, the counterparty's typing indicator and
 * the pending draft.
 *
 * **It is no longer a panel.** The bordered, filled container this used to be made
 * the page read as a stack of identical cards, and worse, it competed with the one
 * object on the page that should be lifted: the pending draft with its guidance.
 * The conversation is now plain content on the canvas, separated by a hairline
 * under its header, so the draft surface is the only bordered thing in view.
 *
 * **The mobile collapse is gone.** §11 hid all but the two most recent messages at
 * ~390px, which made sense when the thread was static. Now the counterparty answers,
 * so hiding history means a narrow screen can never see the conversation it is part
 * of. The page scrolls instead, which is what a phone does anyway.
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
import { TypingIndicator } from "./TypingIndicator";

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
 */
function MessageMeta({ message }: { message: Message }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
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
  typingFrom,
  pending,
  children,
}: {
  thread: ThreadData;
  onReset: () => void;
  /**
   * Who is writing back, or undefined. Present only while a canned reply is on its
   * way, which is the whole reason the wait reads as a person rather than as a
   * stall.
   */
  typingFrom?: string;
  /**
   * The pending draft and its guidance, rendered at the end of the conversation
   * because that is where the message being written belongs. A slot rather than a
   * prop bundle: this component knows nothing about findings, and keeping it that
   * way is what lets the seeded threads be asserted on in a Node test.
   */
  pending?: React.ReactNode;
  /** The recipient switcher, which belongs inside the header per §2's wireframe. */
  children?: React.ReactNode;
}) {
  const messages = thread.messages;

  return (
    <section aria-label={thread.title}>
      {/*
        A quiet channel header (T3.3.1). The title is 16px semibold rather than the
        22px it was: this is chrome, and at 22px it was the largest thing on the
        page, competing with the guidance that is supposed to be the loudest voice
        in the interface. Hierarchy is what an object is next to, not what it is.
      */}
      <header className="border-b border-hairline pb-4">
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

      {/* The rhythm is 24px between speakers and 4px between a name and what they
          said, so the gaps group the rows rather than sitting evenly and grouping
          nothing. A continuation from the same author closes to 8px, which is what
          makes two messages read as one turn. */}
      <ol className="flex flex-col pt-5">
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined;
          const continues = previous !== undefined && previous.from === message.from;

          return (
            <li
              key={message.id}
              className={index === 0 ? "" : continues ? "mt-2" : "mt-6"}
            >
              {continues ? null : <MessageMeta message={message} />}
              {/* A reading measure, because 15px running the full width of the app
                  column is 95 characters and nobody reads that comfortably. */}
              <p
                className={`max-w-reading text-base text-ink ${continues ? "" : "mt-1"}`}
              >
                {message.text}
              </p>
            </li>
          );
        })}
      </ol>

      {typingFrom ? <TypingIndicator from={typingFrom} /> : null}

      {pending}
    </section>
  );
}
