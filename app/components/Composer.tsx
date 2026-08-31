"use client";

import Link from "next/link";

/**
 * The composer: the draft field, the ghost hint, the status line, the example
 * replies and the send control.
 *
 * **The field is not here on screen any more, only in this file.** `DraftField`
 * is exported and rendered INSIDE the pending draft surface, in the slot the
 * draft's body used to occupy. Before that, the sentence the visitor typed was
 * painted twice, once as the bubble's body and once in a bordered box below it,
 * and a visitor reading their own sentence twice reads a bug. One field, one
 * copy of the text, and the bubble is the thing you type into. The furniture
 * below (examples, send, status) stays with this component.
 *
 * The pure decisions live in exported functions at the top of the file rather
 * than inside the component, because they are the parts with a right answer:
 * which occurrence of a sentence an accept acts on, which findings still refer to
 * text that exists, what the status line is allowed to claim, and when the send
 * button changes its words. `Composer.test.tsx` covers each of them. The JSX
 * below is wiring.
 *
 * Two things here are product decisions rather than implementation choices:
 *
 *   - **The ghost is a HINT, not the textarea's value** (§4, F27). Focus alone
 *     inserts nothing, so Tab and a click behave normally and a caret can be
 *     placed. If the ghost were the value, the scan that fires on reaching
 *     `ready` would render a high-severity card under an untouched composer,
 *     which destroys both the causality of the demo and the "you have not sent
 *     anything yet" framing the whole product rests on.
 *   - **The status line never shows a number it cannot vouch for.** While a
 *     download is in flight the engine reports `null`, and `0 network requests`
 *     beside a running download is precisely the fake zero the product's whole
 *     claim would die on.
 */

import { useState } from "react";
import type { EngineStatus } from "@/app/lib/useEngine";
import type { Finding } from "@/app/lib/types";
import type { ThreadMode } from "./Thread";

const DEVICE_LABEL = { webgpu: "WebGPU", wasm: "WASM" } as const;

/** §14 copy deck. Transcribed, never composed, so wording is decided once. */
const COPY = {
  booting: "Getting ready. This downloads once.",
  bootingWhy:
    "The checker runs on your computer, which is why nothing you type has to leave it.",
  ready: "Checking as you type. Nothing has left your computer.",
  degraded:
    "Full checking isn't available in this browser. The simple checks are still running.",
  downloading: "Downloading. Nothing you type is being sent.",
  howDoIKnow: "How do I know?",
  seeRules: "See the rules this checks against",
  runningOn: "Running on",
  /**
   * "since the checker was ready", NOT "since loading", and the distinction is the
   * whole point of the line.
   *
   * The number beside this label counts from the moment the checker finished
   * arriving. Since loading, the honest figure includes the requests that fetched the
   * checker itself, which on a real load is 7. So the old label was describing a
   * different measurement from the one being displayed, and it sat immediately above a
   * sentence asserting the figure was zero. Whichever of the two a reader believed,
   * the panel contradicted itself.
   *
   * A label that names a wider window than the number covers is the same failure as a
   * wrong number, and this panel is the only evidence offered for the product's
   * central claim.
   */
  requestsSince: "Requests since the checker was ready",
  proofSentence:
    "The checker was downloaded once. Since then this page has made no requests, so your draft cannot have been sent anywhere.",
  sendDefault: "Send",
  sendAnyway: "Send anyway",
  notePrompt: "Add a note for yourself (optional, stays on this device)",
  ghost: 'Try: "Yes, we guarantee your data never leaves the US."',
  ghostInsert: "Yes, we guarantee your data never leaves the US.",
  composerLabel: "Your reply",
  /**
   * On screen, not only in the accessibility tree. This row used to carry
   * `Example replies` as an `aria-label` and nothing visible, so a screen reader
   * was told what the three pills were and a sighted visitor was not: measured as
   * three bare pills that could equally have been filters, tags, or the names of
   * something already applied. One string now does both jobs, which is also the
   * only way the visible and the announced name cannot drift apart.
   */
  examplesLabel: "Try one of these",
} as const;

/** The visible label's id, so the pill row can point its accessible name at it. */
const EXAMPLES_LABEL_ID = "composer-examples-label";

export const GHOST_HINT = COPY.ghost;
export const GHOST_INSERT = COPY.ghostInsert;
/** The field's accessible name. Exported so it can be asserted on, and so the
 *  name cannot drift now that the field renders inside another component. */
export const COMPOSER_LABEL = COPY.composerLabel;

/**
 * Which state the line describes, carried separately from the words.
 *
 * The component keys its fade on this rather than on the text, which is the whole
 * reason it exists: keyed on the text, the percentage climbing from 7% to 8% would
 * re-run the enter animation, so the line would flicker roughly a hundred times
 * during the download. Keyed on the kind, the words cross-fade when the state
 * genuinely changes and the percentage updates in place.
 */
export type StatusLineKind = "booting" | "downloading" | "ready" | "degraded";

export type StatusLine = {
  kind: StatusLineKind;
  text: string;
  /** A second, quieter line. Only the booting state has one. */
  detail?: string;
  /**
   * Present only when the engine has reported a real number, which is the booting
   * state and nothing else. It is never synthesised, never eased toward 100, and
   * absent rather than guessed: the download in the `downloading` state below has no
   * percentage, so it gets no bar rather than an invented one (T3.4.2).
   */
  pct?: number;
  /** Technical proof for the disclosure. Only present when ready. */
  device?: "webgpu" | "wasm";
  requestCount?: number | null;
};

/**
 * What the status line is allowed to say.
 *
 * `requestsSinceReady` is null while any realm has a request in flight, and that
 * null is the whole point of the field: the honest thing to render then is the
 * download, never a zero.
 */
export function statusLine(
  status: EngineStatus,
  requestsSinceReady: number | null,
): StatusLine {
  if (status.kind === "booting") {
    const pct = Math.max(0, Math.min(100, Math.round(status.pct)));
    return { kind: "booting", text: `${COPY.booting} ${pct}%`, detail: COPY.bootingWhy, pct };
  }
  if (status.kind === "degraded") {
    return { kind: "degraded", text: COPY.degraded };
  }
  if (requestsSinceReady === null) {
    return { kind: "downloading", text: COPY.downloading };
  }
  return {
    kind: "ready",
    text: COPY.ready,
    device: status.device,
    requestCount: requestsSinceReady,
  };
}

/**
 * The button's words. Only an unresolved HIGH finding changes them (T4.5.1);
 * medium and low leave it reading `Send`. Sending always succeeds either way, so
 * the label is information rather than a gate.
 */
export function sendLabel(findings: readonly Finding[]): string {
  return findings.some((finding) => finding.severity === "high")
    ? COPY.sendAnyway
    : COPY.sendDefault;
}

/** The suppression key is (rule, exact text), never per occurrence (§8.2). */
export function suppressionKey(
  finding: Pick<Finding, "ruleId" | "matchedText">,
): string {
  return `${finding.ruleId}\u0000${finding.matchedText}`;
}

/**
 * Findings that still refer to text in the draft, minus the suppressed ones.
 *
 * Dropping a finding whose `matchedText` has gone (T4.3.6) is not tidiness: the
 * visitor edited the sentence out from under an open card, and a suggestion
 * pointing at text that no longer exists is worse than no suggestion. It is also
 * what makes `Keep mine` expire on its own, since a suppression keyed to text
 * that is gone can never match again.
 */
export function visibleFindings(
  findings: readonly Finding[],
  draft: string,
  suppressed: ReadonlySet<string>,
): Finding[] {
  return findings.filter(
    (finding) =>
      finding.matchedText.length > 0 &&
      draft.includes(finding.matchedText) &&
      !suppressed.has(suppressionKey(finding)),
  );
}

/**
 * Every index at which `needle` occurs in `haystack`. Overlapping occurrences are
 * not a concern for whole sentences, so this steps past each hit.
 */
export function occurrences(haystack: string, needle: string): number[] {
  if (needle.length === 0) return [];
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return found;
    found.push(at);
    from = at + needle.length;
  }
}

/**
 * The three-step locate from §8.1, and the reason it has three steps (F9).
 *
 * `matchedText` alone is not an identity: segmentation legitimately produces two
 * findings with the same (ruleId, matchedText) pair. Matching on text alone
 * rewrites the FIRST occurrence when a draft contains the same sentence twice, so
 * the visitor watches the wrong paragraph change while the card they clicked
 * reappears. `start` is not trusted blindly either, because the draft can have
 * been edited between render and click.
 *
 * Returns null when the text is gone, and the caller abandons silently and
 * re-scans rather than guessing.
 */
export function applyReplacement(
  draft: string,
  finding: Pick<Finding, "matchedText" | "start" | "end">,
  replacement: string,
): string | null {
  const { matchedText, start, end } = finding;
  if (matchedText.length === 0) return null;

  if (start >= 0 && draft.slice(start, end) === matchedText) {
    return draft.slice(0, start) + replacement + draft.slice(end);
  }

  const found = occurrences(draft, matchedText);
  if (found.length === 0) return null;

  let nearest = found[0];
  for (const at of found) {
    if (Math.abs(at - start) < Math.abs(nearest - start)) nearest = at;
  }
  return (
    draft.slice(0, nearest) + replacement + draft.slice(nearest + matchedText.length)
  );
}

/**
 * Removing a term leaves the surrounding spaces behind, and `we damn well
 * guarantee` would become `we  well guarantee`. Collapsing runs of spaces is the
 * whole of the tidying: nothing else about the visitor's text is touched.
 */
export function tidySpacing(draft: string): string {
  return draft.replace(/ {2,}/g, " ").replace(/ +([,.;:!?])/g, "$1");
}

export type ExampleReply = {
  id: string;
  /** What the row shows. Short, so three of them fit at ~390px. */
  label: string;
  /** What lands in the composer. */
  text: string;
};

/**
 * Three example replies, and the third one is the important one (§4).
 *
 * A visitor who only ever sees the product fire has no evidence it stays quiet,
 * and staying quiet is most of the credibility. `calm` contains no cue of any
 * rule, so it cannot fire at any threshold: the silence is structural rather than
 * lucky.
 *
 * The set is per thread because a rule scoped to external contexts cannot fire
 * internally, and an example that can never produce anything in the thread it is
 * offered in teaches the visitor nothing. Internally the row leads with a tone
 * example, which does apply inside the company, and keeps the residency promise
 * second precisely so its silence can be compared against the same sentence in
 * the external thread.
 */
export const EXAMPLE_REPLIES: Record<ThreadMode, readonly ExampleReply[]> = {
  external: [
    {
      id: "residency",
      label: "Promise where the data lives",
      text: "Yes, we guarantee your data never leaves the US.",
    },
    {
      id: "delivery",
      label: "Promise a delivery date",
      text: "That will be ready by the end of next month.",
    },
    {
      id: "calm",
      label: "Offer to come back with an answer",
      text: "Happy to check with the team and come back to you tomorrow with what we know.",
    },
  ],
  internal: [
    {
      id: "tone",
      label: "Blunt note on the plan",
      text: "Did you even read the migration plan, honestly, this is a stupid way to do it.",
    },
    {
      id: "residency",
      label: "Promise where the data lives",
      text: "Yes, we guarantee your data never leaves the US.",
    },
    {
      id: "calm",
      label: "Offer to come back with an answer",
      text: "Happy to check with the team and come back to you tomorrow with what we know.",
    },
  ],
};

/**
 * The example replies. `transition-control` rather than `transition-quiet`, because
 * the hover changes a background and a colour and `transition-quiet` animates
 * neither, so every hover in this composer used to snap while claiming not to.
 */
const QUIET_BUTTON =
  "shrink-0 whitespace-nowrap rounded-full border border-hairline bg-surface px-3 py-2 text-xs text-ink-secondary transition-control hover:bg-sunken hover:text-ink";

/**
 * Send is the one filled control in the product when the draft is clean or has only
 * medium/low findings. When an unresolved HIGH finding exists, `Send anyway` becomes
 * quiet (bordered, surface background, no accent fill), because the loudest thing on
 * screen should be the thing the visitor should probably do. In that state, nothing
 * is filled-primary, which is correct: `Use this` and `Keep mine` must keep equal
 * weight to each other, and neither may become primary.
 *
 * The same quiet class carries the EMPTY draft, and empty wins over everything
 * else. Measured on a fresh load at 1280: the send control was filled with the
 * accent and was not disabled, so the loudest control on the page did nothing at
 * all. There is no third treatment for it, because a filled control that cannot
 * act and a quiet control that cannot act are the same mistake at two volumes:
 * the quiet class plus a real `disabled` is the honest one. The words stay `Send`,
 * and nothing explains it, because the hint inside the field already says what to
 * type.
 *
 * T3.2.4 makes `Use this` and `Keep mine` equal in weight because the card is
 * advice and a primary button would turn advice into instruction. Send is not
 * advice: it is the visitor's own act, the thing they came to do, and the product
 * never stands in front of it (§8.5). But when a high finding exists, the visual
 * hierarchy inverts: bypass becomes quiet, and the guidance actions stay equal.
 *
 * Ratios, light · dark: --text-inverse on --accent-strong 8.28 · 9.53 at rest, on
 * --accent 5.13 · 7.28 on hover, and the button's edge against the canvas reads
 * 8.00 · 9.53. The hover brightens rather than darkens because there is no token
 * below --accent-strong and inventing one for a hover state would be a worse trade
 * than moving up the ramp.
 */
const SEND_CLASS_PRIMARY =
  "w-auto shrink-0 rounded-md border border-accent-strong bg-accent-strong px-4 py-2 " +
  "text-sm font-medium text-ink-inverse transition-control hover:border-accent hover:bg-accent";

/* The disabled trio is on the quiet class rather than appended at the call site,
   so the state set travels with the treatment: a `:disabled` button still matches
   `:hover` in most browsers, which is why the hover has to be answered here. */
const SEND_CLASS_QUIET =
  "w-auto shrink-0 rounded-md border border-control bg-surface px-4 py-2 " +
  "text-sm font-medium text-ink transition-control hover:bg-sunken " +
  "disabled:cursor-default disabled:text-ink-muted disabled:hover:bg-surface";

/**
 * The send label reserves the width of the longer of the two words it can be, and
 * that reservation is load-bearing rather than tidy.
 *
 * `Send` becomes `Send anyway` at the exact moment an unresolved HIGH appears,
 * which is the same moment guidance opens. That is 48px more button, taken out of
 * the `flex-1` examples row beside it, which wrapped to a second line and made the
 * whole row 41px taller at the one instant the visitor is reading the card above it.
 * Measured in a browser at 1512px, 39px row to 80px. A row that grows here pushes
 * the accept and reject buttons up the screen, which is the last thing that should
 * move while somebody is deciding whether to press one of them.
 *
 * A 1x1 grid with both labels stacked is the fix, because it sizes the control to
 * the widest string it will ever hold without naming a pixel width that would need
 * re-measuring every time the copy changes. The reserve copy is `aria-hidden`, so
 * the accessible name stays the one visible word.
 */
function SendLabel({ label }: { label: string }) {
  return (
    <span className="grid">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {COPY.sendAnyway}
      </span>
      <span className="col-start-1 row-start-1 text-center">{label}</span>
    </span>
  );
}

/**
 * The draft field, which is the pending message's body.
 *
 * It has no box of its own: no border, no background, no padding, no radius, and
 * the message type size and ink. The surface it sits in supplies all of that,
 * because the surface IS the field now, which is also where the focus ring goes
 * (see `PendingDraft`). A bordered field inside a bordered bubble would be the
 * nested card this design system bans, and it would put a second ring inside the
 * one that already means "this is where you are typing".
 *
 * **Auto-grow without measuring anything.** A hidden twin of the text shares one
 * grid cell with the textarea and carries identical type, so the cell is exactly
 * as tall as the text wants to be and the textarea stretches to it. The
 * alternative, an effect that reads `scrollHeight` and writes `style.height`,
 * costs a forced reflow on every keystroke and lands one frame late, which is
 * visible as a jitter on the line that wraps.
 *
 * Three details in there are load-bearing:
 *
 *   - **The twin holds `draft + " "`**, not `draft`. A trailing space reserves the
 *     room the caret needs at the end of a full line, and a trailing NEWLINE
 *     instead would reserve a whole empty line and read as a gap.
 *   - **`min-h-12` is two lines**, which is what the ghost hint occupies when it
 *     wraps at ~390px. Without it the first keystroke would collapse the field
 *     from two lines to one, and the requirement is no layout jump on the first
 *     character.
 *   - **`max-h-64` on both layers** caps the growth at around ten lines, so the
 *     scrollbar appears only when the draft is genuinely tall rather than at the
 *     third line.
 *
 * The field is full width rather than held to a reading measure, even though the
 * message bodies above it are. The measure is a reading aid, and here the width
 * is also the click target: the visitor should be able to click anywhere across
 * the bubble and land a caret. 46rem minus the surface's padding is roughly 80
 * characters, which is wide for reading and correct for writing your own sentence.
 */
export function DraftField({
  draft,
  textareaRef,
  onDraftChange,
  onInsert,
}: {
  draft: string;
  /** Owned by the page, because the example replies focus this field too. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (draft: string) => void;
  /** A click on the hint, or Enter on an empty field. Scans with no debounce (§6). */
  onInsert: (text: string) => void;
}) {
  const showGhost = draft === "";

  return (
    <div className="mt-1 grid min-h-12">
      {/* The twin. `aria-hidden` and `invisible` rather than `hidden`, because it
          has to be laid out to be measured. `break-words` matches what a textarea
          does to a long unbroken string, or the twin would under-measure it. */}
      <div
        aria-hidden="true"
        className="invisible col-start-1 row-start-1 max-h-64 overflow-hidden whitespace-pre-wrap break-words text-base text-ink"
      >
        {`${draft} `}
      </div>

      <textarea
        ref={textareaRef}
        aria-label={COPY.composerLabel}
        value={draft}
        /* One row. The twin decides the height from here on, and `rows={2}` would
           set a two-line floor in the wrong place: `min-h-12` on the wrapper is
           where that floor belongs, because the ghost hint has to fit in it too. */
        rows={1}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          /* Enter inserts the hint only while the field is empty (§4). Otherwise
             Enter is a newline: this is a chat composer, and a send on Enter
             beside an open card would read as a trap. */
          if (event.key === "Enter" && !event.shiftKey && draft === "") {
            event.preventDefault();
            onInsert(COPY.ghostInsert);
          }
        }}
        /* `outline-hidden` rather than `outline-none`: it still paints a visible
           outline under forced colours, and the ring the visitor sees is the one
           on the surface. globals.css owns the only `outline: none` in the
           project and this is not a second one. */
        className="col-start-1 row-start-1 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-base text-ink focus-visible:outline-hidden"
      />

      {/* The hint shares the same grid cell and is `pointer-events-none`, so a
          click anywhere in the field still places a caret. Only the hint's own
          text takes the click, which is the explicit gesture §4 asks for. It
          renders after the textarea so no z-index is needed. Focus alone inserts
          nothing: this is a hint, never the textarea's value (F27). */}
      {showGhost ? (
        <div className="pointer-events-none col-start-1 row-start-1">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onInsert(COPY.ghostInsert)}
            className="pointer-events-auto text-left text-base text-ink-muted"
          >
            {COPY.ghost}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type ComposerProps = {
  mode: ThreadMode;
  status: EngineStatus;
  requestsSinceReady: number | null;
  /** Already filtered to what is on screen, so the label matches the cards. */
  findings: readonly Finding[];
  /**
   * Whether there is anything to send. The page owns the draft, and the composer
   * cannot see it any more now that the field renders inside the pending surface,
   * so it has to be told. Whitespace alone counts as empty, which is what `onSend`
   * up in the page already decides.
   */
  draftEmpty: boolean;
  /** A click on an example. Scans with no debounce (§6). */
  onInsert: (text: string) => void;
  onSend: (note: string) => void;
};

export function Composer({
  mode,
  status,
  requestsSinceReady,
  findings,
  draftEmpty,
  onInsert,
  onSend,
}: ComposerProps) {
  const line = statusLine(status, requestsSinceReady);
  /* Empty beats everything, written out rather than left to the fact that an
     empty draft cannot hold a finding. The two states arrive from different
     places, they can disagree for a frame, and `Send anyway` on a button that
     cannot send is the one wording here that would read as a taunt. */
  const label = draftEmpty ? COPY.sendDefault : sendLabel(findings);
  const highUnresolved = !draftEmpty && label === COPY.sendAnyway;
  const sendClass = draftEmpty || highUnresolved ? SEND_CLASS_QUIET : SEND_CLASS_PRIMARY;

  return (
    <div>
      {/*
        One row on every screen. At ~390px three stacked example pills plus a
        full-width send took a third of the phone, and this row now sits below the
        draft surface, so every line it grows pushes the guidance further up. The
        examples scroll sideways instead, bleeding to the edges so the row reads as
        scrollable rather than clipped, and they wrap normally once there is room.
      */}
      {/*
        The row's one visible label, and it is the quietest text here on purpose.
        Everything below it pushes the guidance up the screen, so the budget is one
        line: `text-xs` with `mt-1` under it and no padding of its own, which is
        about 20px in total. It sits above the whole row rather than inside the
        scrolling pill track, so it cannot slide sideways out of view at ~390px and
        the send control stays aligned with the pills instead of with this line.
      */}
      <p id={EXAMPLES_LABEL_ID} className="text-xs text-ink-muted">
        {COPY.examplesLabel}
      </p>

      <div className="mt-1 flex items-start gap-3">
        <div
          role="group"
          /* Pointed at the visible words, never a second copy of them. */
          aria-labelledby={EXAMPLES_LABEL_ID}
          /*
             The bleed is LEFT only. `-mx-4` bled both ways, and on the right there
             is no screen edge to bleed to: the send control is there, 12px away,
             so a 16px right bleed put the track's edge 4px underneath the button.
             Measured at 390px with the row scrolled to the end, the last pill was
             cut off exactly at the button's border with no gap, which reads as two
             controls colliding rather than as a row that scrolls. Left bleed keeps
             the affordance, `pr-1` keeps the clip clear of the button.
          */
          className="-ml-4 flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 pl-4 pr-1 sm:ml-0 sm:flex-wrap sm:overflow-x-visible sm:pb-0 sm:pl-0 sm:pr-0"
        >
          {EXAMPLE_REPLIES[mode].map((example) => (
            <button
              key={example.id}
              type="button"
              className={QUIET_BUTTON}
              onClick={() => onInsert(example.text)}
            >
              {example.label}
            </button>
          ))}
        </div>

        <SendControl
          label={label}
          revealNote={highUnresolved}
          sendClass={sendClass}
          disabled={draftEmpty}
          onSend={onSend}
        />
      </div>

      {/*
        The first ten seconds of this product, which are the ten seconds every
        visitor sees and the ones most likely to be spent on nothing.

        It sits BELOW the send row rather than between the field and the actions: it
        is the quietest line here and it belongs at the quietest edge. Putting it
        last also means the send button cannot move when the booting state's second
        line goes away, and the reserved height is what stops everything above it,
        the guidance included, from stepping down the screen when the download
        finishes (§2).
      */}
      <div className="mt-3 min-h-status">
        {line.pct === undefined ? null : <ProgressRule pct={line.pct} />}

        {/*
          Keyed on the state, not the words, so the line cross-fades when the
          product actually changes state and does not re-animate on every
          percentage tick. This is the difference between a status line that
          transitions and one that snaps four times during a page load.
        */}
        <div
          key={line.kind}
          className={`animate-rise-in ${line.pct === undefined ? "" : "mt-2"}`}
        >
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {/* `tabular-nums` so the percentage does not shuffle the words after it
                as it climbs through 9% to 10%. */}
            <p className="text-sm tabular-nums text-ink-secondary">{line.text}</p>
            {line.kind === "ready" && line.device !== undefined && line.requestCount !== undefined ? (
              <StatusDisclosure device={line.device} requestCount={line.requestCount} />
            ) : null}
            {/*
              The pointer to the rules, reachable at the moment of typing. Quiet and
              plainly worded, so it is available without competing with the guidance
              or the send control.
            */}
            <Link
              href="/settings"
              className="text-xs text-ink-muted underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control"
            >
              {COPY.seeRules}
            </Link>
          </div>
          {line.detail ? (
            <p className="mt-1 max-w-reading text-xs text-ink-muted">{line.detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * The disclosure for technical proof. Quiet, keyboard reachable, closed by default.
 * Uses a simple button toggle pattern rather than details/summary for predictable
 * styling. The content appears with the same fade-and-rise as the rest of the product.
 */
function StatusDisclosure({
  device,
  requestCount,
}: {
  device: "webgpu" | "wasm";
  requestCount: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="rounded-sm text-ink-muted underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control"
      >
        {COPY.howDoIKnow}
      </button>
      {open ? (
        <div className="animate-rise-in mt-2 max-w-reading space-y-2 text-ink-muted">
          <p>
            <span className="font-medium">{COPY.runningOn}</span>{" "}
            <span className="font-mono">{DEVICE_LABEL[device]}</span>
          </p>
          {requestCount !== null ? (
            <p>
              <span className="font-medium">{COPY.requestsSince}</span>{" "}
              <span className="font-mono tabular-nums">{requestCount}</span>
            </p>
          ) : null}
          <p>{COPY.proofSentence}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The download, drawn honestly.
 *
 * A determinate rule across the full width of the composer, never a spinner
 * (T3.4.2): a spinner says "something is happening", and the thing this product
 * needs the visitor to understand is that a specific, finite, one-time thing is
 * happening, which is why nothing they type has to leave the machine. The
 * percentage in the line above comes from the engine's own `progress_callback`, and
 * this bar is the same number drawn.
 *
 * `scaleX` rather than `width`, for two reasons that agree. The design system's
 * motion vocabulary is opacity and transforms, and a transform does not invalidate
 * layout, so a bar updating a few times a second costs nothing on a machine that is
 * simultaneously decompressing 22MB of weights. 180ms means each step glides into
 * the next instead of stuttering.
 *
 * The accessible name is the visible line's own words rather than an invented one,
 * and the rail reads 4.22:1 light and 5.64:1 dark against its track, clear of the
 * 3:1 that 1.4.11 asks of an indicator that carries meaning.
 */
function ProgressRule({ pct }: { pct: number }) {
  return (
    <div
      role="progressbar"
      aria-label={COPY.booting}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="progress-track w-full overflow-hidden rounded-full bg-hairline"
    >
      <div
        className="h-full w-full origin-left rounded-full bg-accent transition-quiet duration-slow"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

/**
 * Send, and the note that is genuinely optional (§8.3).
 *
 * The first click on `Send anyway` reveals the note line; the second sends,
 * whether or not anything was typed into it. Requiring a justification to send is
 * enforcement wearing a friendly hat, so the revealed control always sends. The
 * note never leaves this component's parent, which holds it in memory.
 *
 * `disabled` is threaded to both branches even though only the first can be
 * reached while it is true: `revealNote` is false whenever the draft is empty, so
 * the note branch is unreachable there today, and a control that would send on a
 * click is not the place to rely on that staying true.
 */
function SendControl({
  label,
  revealNote,
  sendClass,
  disabled,
  onSend,
}: {
  label: string;
  revealNote: boolean;
  sendClass: string;
  /** Nothing to send. The one state that outranks every other here. */
  disabled: boolean;
  onSend: (note: string) => void;
}) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  const send = () => {
    onSend(note.trim());
    setNote("");
    setNoteOpen(false);
  };

  if (!revealNote || noteOpen) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-2">
        {noteOpen ? (
          /* Arrives by the same fade-and-rise as everything else that appears in
             this product. A control that materialises instantly beside one that
             fades reads as two different pieces of software. */
          <label className="animate-rise-in flex w-52 flex-col gap-1 text-xs text-ink-secondary sm:w-80">
            {COPY.notePrompt}
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-md border border-control bg-surface px-3 py-2 text-sm text-ink transition-control"
            />
          </label>
        ) : null}
        <button type="button" className={sendClass} disabled={disabled} onClick={send}>
          <SendLabel label={label} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={sendClass}
      disabled={disabled}
      onClick={() => setNoteOpen(true)}
    >
      <SendLabel label={label} />
    </button>
  );
}
