/**
 * The counterparty's side of the conversation.
 *
 * The client asked that the thread continue after a send: you answer, and the
 * person you answered writes back. In this pass those replies are canned, and
 * this module is the whole of the canning. A local generative model replaces
 * `nextReply` later.
 *
 * **The seam is the function, not the table.** `nextReply` is async, takes a
 * request object, and returns a draft or `null`, which is the shape a small
 * on-device model can satisfy without a single change in the components: it can
 * await weights, it can look at the history, and it can decline to answer. If
 * the components indexed a exported record by key instead, swapping in a model
 * would mean rewriting every caller, which is exactly the coupling this avoids.
 *
 * Two content rules, both from `content-safety.md`, and neither is negotiable:
 * `example.com` is the only external domain that may appear, and no real company
 * is ever named. The replies are also deliberately dull. Real customer email has
 * no jokes in it, and a witty counterparty would turn the demo into a toy.
 */

import type { RecipientKind } from "./types";

/**
 * Which conversation the reply belongs to, so a reply plausibly follows what was
 * actually sent. A residency promise gets a security reviewer's answer; a date
 * gets a planning answer.
 */
export type ReplyTopic =
  | "residency"
  | "delivery"
  | "pricing"
  | "security"
  | "channel"
  | "tone"
  | "general";

export type ReplyRequest = {
  /** The message that was just sent, verbatim. */
  sent: string;
  recipientKind: RecipientKind;
  /** Who is replying: `Sam` externally, `Priya` internally. */
  from: string;
  /** Prior message texts, oldest first. A model would condition on these. */
  history: readonly string[];
};

export type ReplyDraft = {
  from: string;
  text: string;
};

/**
 * Cues, longest-intent first. Ordered rather than scored on purpose: a promise
 * about where data lives that also mentions a date is a residency answer, and an
 * ordered walk says so in one readable line where a weighted match would need a
 * tie-break nobody could predict.
 */
const TOPIC_CUES: readonly (readonly [ReplyTopic, readonly string[]])[] = [
  ["residency", ["data", "residency", "region", "stays inside", "leaves the us", "stored"]],
  ["security", ["secure", "security", "encrypt", "audit", "penetration", "certif", "soc 2", "soc2"]],
  ["delivery", ["by the end", "next month", "next week", "ship", "deliver", "timeline", "date", "thursday"]],
  ["pricing", ["price", "pricing", "discount", "renewal", "cost", "quote"]],
  ["channel", ["off the record", "call me", "text me", "my personal", "between us"]],
  ["tone", ["stupid", "honestly", "did you even", "nonsense", "ridiculous"]],
];

/**
 * Exported because it is the one decision in this module with a right answer, and
 * because a model implementation will still want it: a classifier that ignores
 * what was said would produce a non sequitur, which is worse than a dull reply.
 */
export function replyTopic(sent: string): ReplyTopic {
  const text = sent.toLowerCase();
  for (const [topic, cues] of TOPIC_CUES) {
    if (cues.some((cue) => text.includes(cue))) return topic;
  }
  return "general";
}

/**
 * Two or three per topic per context. Rotation is by history length rather than
 * by `Math.random`, so a reload replays the same conversation and nothing in the
 * thread depends on a value the server could not have produced.
 */
const EXTERNAL: Record<ReplyTopic, readonly string[]> = {
  residency: [
    "Thanks. I will forward that to our security reviewer, and they will come back to you if the contract wording needs to change.",
    "Understood. Could you send it in writing as well, so I can attach it to the review before Thursday.",
  ],
  security: [
    "That helps. Our reviewer will almost certainly ask for the most recent report, so I will put that request in now.",
    "Noted, thank you. I will pass this to the team doing the technical review.",
  ],
  delivery: [
    "Noted. If the date moves, tell me as early as you can and I will let the steering group know.",
    "That works for our planning. I will keep Thursday as the checkpoint either way.",
  ],
  pricing: [
    "Thanks. I will take that to procurement, though they will want the numbers on the order form rather than in email.",
    "Understood. Send the figures over when you have them confirmed and I will start the internal approval.",
  ],
  channel: [
    "Happy to talk, though I would rather keep the answer in this thread so the reviewers can see it.",
    "Let us keep it here for now. I have to show the review group where the answer came from.",
  ],
  tone: [
    "Understood. I will read it again and come back with specifics.",
    "Fair enough. Let me look at it properly and reply tomorrow.",
  ],
  general: [
    "Thanks for coming back to me. I will read through this and follow up before Thursday.",
    "Got it, thank you. I will share this with the rest of the evaluation group.",
  ],
};

/**
 * The internal set names no customer and no domain (F25). The internal thread has
 * to stay free of `example.com` and of the external participant's name, and a
 * canned reply is the easiest place for one to leak back in.
 */
const INTERNAL: Record<ReplyTopic, readonly string[]> = {
  residency: [
    "Worth checking that with legal before it goes to the customer, the answer depends on which region they land in.",
    "I think that is only true for the single-region setup. Let me confirm and get back to you.",
  ],
  security: [
    "We have the current report in the shared drive if you need to quote from it.",
    "Reasonable, though I would keep it to what the report actually says.",
  ],
  delivery: [
    "That is tighter than the plan I circulated. Can we talk before anyone commits to it.",
    "I can probably make that work, but the migration has to land first.",
  ],
  pricing: [
    "Send that to the deal desk rather than deciding it here.",
    "I would rather not put numbers in writing until the order form is drafted.",
  ],
  channel: [
    "A call is fine, but write the outcome down here afterwards.",
    "Sure, though the decision needs to end up in this thread either way.",
  ],
  tone: [
    "Fair enough. I will write up the reasoning behind the rollout order so we can argue about the substance.",
    "Understood. The order is in the plan, second section, if it helps.",
  ],
  general: [
    "Thanks, that helps. I will update the plan and re-share it this afternoon.",
    "Noted. I will fold that into the next revision.",
  ],
};

/**
 * The pause before a reply, split in two because a single delay is a lie about
 * what is happening.
 *
 * `beforeMs` is the gap before the other person starts typing, and `typingMs` is
 * how long they spend on it. Length-proportional and clamped: a one-line answer
 * that takes six seconds reads as a stall, and a four-line answer that lands in
 * 300ms reads as a canned response, which it is, so the timing is the only thing
 * hiding it.
 */
export function replyTimings(text: string): { beforeMs: number; typingMs: number } {
  const typingMs = Math.min(3200, Math.max(1200, 400 + text.length * 14));
  return { beforeMs: 700, typingMs };
}

/**
 * The seam. Async, request in, draft or nothing out.
 *
 * A local model implementation keeps this signature: awaits its own weights,
 * conditions on `history` and `recipientKind`, and returns `null` when it has
 * nothing worth saying, at which point the thread simply does not gain a message.
 * Nothing in the UI branches on where the text came from.
 */
export async function nextReply(request: ReplyRequest): Promise<ReplyDraft | null> {
  const sent = request.sent.trim();
  if (sent === "") return null;

  const table = request.recipientKind === "internal" ? INTERNAL : EXTERNAL;
  const options = table[replyTopic(sent)];
  if (options.length === 0) return null;

  // Deterministic rotation. `Math.random` here would make the thread differ
  // between a server render and the first client render, and it would make the
  // demo unrepeatable for anyone showing it to someone else.
  //
  // The index counts EXCHANGES, not messages, and that halving is the whole point:
  // a round adds two messages to the thread, the one you sent and the one that came
  // back, so `history.length % 2` has fixed parity and every reply on a topic would
  // have been word-for-word the one before it. The second variant was unreachable.
  const exchange = Math.floor(request.history.length / 2);
  const text = options[exchange % options.length];
  return { from: request.from, text };
}
