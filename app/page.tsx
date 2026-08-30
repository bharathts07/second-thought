"use client";

import Link from "next/link";

/**
 * The product.
 *
 * This file is the container: it owns the draft, the two threads, the findings,
 * the suppressions, the notes, the scan lifecycle, and now the counterparty's
 * side of the conversation. Every child is presentational, and every decision
 * with a right answer lives in a tested pure function in `Composer.tsx`,
 * `GuidancePanel.tsx` or `replies.ts`. What is left here is sequencing, which is
 * the part that cannot be unit tested without a browser.
 *
 * The five things this file exists to get right:
 *
 *   1. **A scan result can arrive after the state it described is gone.** Every
 *      scan takes a sequence number, and a result whose number is stale is
 *      dropped rather than rendered. The engine's own `superseded` flag is
 *      honoured too, since a WASM scan of a long draft can finish after a later
 *      scan of a short one.
 *   2. **Nothing is cleared speculatively.** While a scan is in flight the
 *      existing guidance stays: flicker on every keystroke reads as broken.
 *      Findings are replaced only when a result arrives, and on a recipient
 *      switch only the out-of-scope ones are dropped (F26).
 *   3. **Sending never waits.** `onSend` touches no promise that could block it.
 *      Blocking a send on a classifier is the behaviour of an enforcement tool,
 *      and this is not one.
 *   4. **The draft is a message in the thread before it is sent.** The pending
 *      bubble and its guidance are one surface at the end of the conversation, so
 *      the relationship between a sentence and a concern is visible rather than
 *      inferred. Guidance after the send was considered and rejected: it would
 *      make the product post-hoc, which is what every incumbent already is.
 *   5. **The composer never moves.** It is pinned to the bottom of the viewport,
 *      outside the scrolling conversation, so guidance arriving at any size cannot
 *      shift the field under a live cursor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounceMs } from "@/app/lib/scan";
import { useEngine } from "@/app/lib/useEngine";
import { nextReply, replyTimings, type ReplyRequest } from "@/app/lib/replies";
import type { Finding, Recipient } from "@/app/lib/types";
import {
  SEEDED_THREADS,
  Thread,
  type Message,
  type ThreadData,
  type ThreadMode,
} from "@/app/components/Thread";
import { RecipientSwitch } from "@/app/components/RecipientSwitch";
import {
  Composer,
  applyReplacement,
  suppressionKey,
  tidySpacing,
  visibleFindings,
} from "@/app/components/Composer";
import {
  GuidancePanel,
  findingsInScope,
  hasGuidanceContent,
  orderedFindings,
} from "@/app/components/GuidancePanel";
import { FramingStrip } from "@/app/components/FramingStrip";
import { PendingDraft } from "@/app/components/PendingDraft";
import type { RemediationOption } from "@/app/components/FindingCard";

/** §14 copy deck. `page.harness` moved into the framing strip, which is what it describes. */
const COPY = {
  title: "Second Thought",
  disclaimer:
    "Second Thought is a drafting aid. It does not provide legal or compliance advice and " +
    "does not ensure compliance with any law, regulation, or company policy.",
  notesHeading: "Your notes",
  notesDisclaimer: "On this device only. Never sent anywhere.",
} as const;

/** §6: `Nothing to flag.` is visible for two seconds, then the status line returns. */
const CLEAN_MS = 2000;

/** How close to the bottom counts as following the conversation rather than reading it. */
const FOLLOW_PX = 220;

function clockTime(now: Date): string {
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function recipientFor(thread: ThreadData): Recipient {
  return {
    kind: thread.recipientKind,
    label: thread.recipientLabel,
    domain: thread.recipientDomain,
  };
}

/**
 * The role or domain shown beside a name, taken from the seeded thread rather than
 * written out again here. It is how `example.com` stays out of the internal thread
 * (F25) without a second list of labels that could disagree with the first.
 */
function labelFor(mode: ThreadMode, from: string): string | undefined {
  return SEEDED_THREADS[mode].messages.find((message) => message.from === from)?.label;
}

export default function Home() {
  const { status, scan, requestsSinceReady, rules } = useEngine();

  const [mode, setMode] = useState<ThreadMode>("external");
  const [threads, setThreads] = useState<Record<ThreadMode, ThreadData>>(SEEDED_THREADS);
  const [draft, setDraft] = useState("");
  const [findings, setFindings] = useState<readonly Finding[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [clean, setClean] = useState(false);
  const [suppressed, setSuppressed] = useState<ReadonlySet<string>>(new Set());
  const [notes, setNotes] = useState<readonly Message[]>([]);
  /** Which thread has somebody writing back, or null. */
  const [typingIn, setTypingIn] = useState<ThreadMode | null>(null);
  /** The framing strip. Open on arrival, closed for good after the first gesture. */
  const [framingOpen, setFramingOpen] = useState(true);
  /**
   * Forces a re-scan when the draft itself did not change: after an accept whose
   * target had already gone, and after a `Remove it` that produced identical text.
   */
  const [scanNonce, setScanNonce] = useState(0);

  const thread = threads[mode];
  const recipient = useMemo(() => recipientFor(thread), [thread]);
  const device = status.kind === "ready" ? status.device : undefined;

  /** Monotonic. A result from any earlier number is stale by definition. */
  const seq = useRef(0);
  /** Set before a gesture that must scan with no debounce (§6). */
  const immediate = useRef(false);
  /** False until the semantic rung has ever been available, for the ready-scan. */
  const everScanned = useRef(false);
  const cleanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Every pending reply timer, and the generation that owns them. A reset, or a
   * second send, invalidates the generation, so a reply already in flight cannot
   * land in a conversation the visitor has since thrown away.
   */
  const replyTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const replyGeneration = useRef(0);
  /** True from the first keystroke on. Collapses the framing strip exactly once. */
  const interacted = useRef(false);
  /**
   * Whether the visitor was at the bottom of the conversation as of the last time
   * they scrolled.
   *
   * It has to be remembered rather than measured, and that is not a micro
   * optimisation. Guidance arriving adds a few hundred pixels to the document in
   * one frame, so by the time an effect can measure, the distance to the bottom is
   * the height of the thing that just appeared, and every "am I following?" test
   * fails at exactly the moment it matters. Recorded on scroll, it answers the
   * question about the state before the growth, which is the question worth asking.
   */
  const following = useRef(true);

  const clearReplies = useCallback(() => {
    replyGeneration.current += 1;
    for (const timer of replyTimers.current) clearTimeout(timer);
    replyTimers.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (cleanTimer.current) clearTimeout(cleanTimer.current);
      for (const timer of replyTimers.current) clearTimeout(timer);
    };
  }, []);

  const flashClean = useCallback((isClean: boolean) => {
    if (cleanTimer.current) clearTimeout(cleanTimer.current);
    if (!isClean) {
      setClean(false);
      return;
    }
    setClean(true);
    cleanTimer.current = setTimeout(() => setClean(false), CLEAN_MS);
  }, []);

  /**
   * The first gesture, whatever it was.
   *
   * It collapses the framing strip and it turns on the follow-the-conversation
   * scroll. Both are the same idea: before the first keystroke the visitor is
   * reading the page, and after it they are working in it. Scrolling a visitor who
   * has not typed anything would hide the one thing that explains the product.
   */
  const noteInteraction = useCallback(() => {
    if (interacted.current) return;
    interacted.current = true;
    setFramingOpen(false);
  }, []);

  /**
   * The one scan path.
   *
   * It re-runs when `scan` goes from null to a function, which is how a visitor
   * who typed during the download gets their draft checked without touching the
   * keyboard again (§5.1). That first run is immediate rather than debounced,
   * because the visitor has already stopped typing.
   */
  useEffect(() => {
    if (!scan) return;
    if (draft.trim() === "") {
      setFindings([]);
      setTruncated(false);
      flashClean(false);
      return;
    }

    const firstRun = !everScanned.current;
    everScanned.current = true;
    const delay = immediate.current || firstRun ? 0 : debounceMs(device);
    immediate.current = false;

    const timer = setTimeout(() => {
      const mine = ++seq.current;
      scan(draft, recipient)
        .then((result) => {
          // A result for a draft or a recipient that no longer exists renders
          // nothing. Guidance from a state the visitor has left is worse than a
          // brief absence of it. The sequence number is bumped by every gesture
          // that invalidates a scan, which is also what cancels an in-flight one,
          // so the engine's own `superseded` flag has nothing left to add here
          // (and the engine's public `scan` does not expose it).
          if (mine !== seq.current) return;
          setFindings(result.findings);
          setTruncated(result.truncated);
          // Only claim nothing to flag when both rungs actually ran. A rung that
          // could not be evaluated is not a clean draft, and reporting one is the
          // silent false negative the whole engine is built to avoid.
          flashClean(
            result.findings.length === 0 && result.ranSemantic && result.ranPattern,
          );
        })
        .catch(() => {
          // The deterministic rung may still have run. Keeping what is on screen
          // is better than implying a clean draft.
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [draft, recipient, scan, device, scanNonce, flashClean]);

  /** What is actually on screen, and therefore what the send label reads from. */
  const shown = useMemo(
    () => visibleFindings(findings, draft, suppressed),
    [findings, draft, suppressed],
  );

  /**
   * The highest severity on screen, which tints the pending surface's border.
   * `orderedFindings` already sorts by severity then position, so the first one is
   * the answer and there is no second ranking to keep in step with the first.
   */
  const topSeverity = useMemo(() => orderedFindings(shown)[0]?.severity, [shown]);

  const hasGuidance = hasGuidanceContent({
    findings: shown,
    kind: thread.recipientKind,
    truncated,
    clean,
  });

  /**
   * Follow the conversation, the way a chat client does.
   *
   * The pending bubble grows as the visitor types and the guidance zone opens
   * underneath it, both of which extend the document. Pinned to the bottom, the
   * composer stays exactly where it is while the content behind it scrolls, so the
   * caret never moves and the thing the visitor is writing never slides out of
   * view. It deliberately does nothing before the first gesture, and nothing at all
   * if the visitor has scrolled up to read history.
   */
  useEffect(() => {
    const record = () => {
      const doc = document.documentElement;
      following.current =
        doc.scrollHeight - window.scrollY - window.innerHeight <= FOLLOW_PX;
    };
    record();
    window.addEventListener("scroll", record, { passive: true });
    window.addEventListener("resize", record);
    return () => {
      window.removeEventListener("scroll", record);
      window.removeEventListener("resize", record);
    };
  }, []);

  useEffect(() => {
    if (!interacted.current || !following.current) return;
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [draft, hasGuidance, shown.length, thread.messages.length, typingIn]);

  const handleSwitch = useCallback(
    (next: ThreadMode) => {
      if (next === mode) return;
      // Cancel anything in flight: a late result would otherwise render guidance in
      // the context that was meant to be silent, and that race is real.
      seq.current += 1;
      immediate.current = true;
      setMode(next);
      // Not a blanket clear. Tone findings apply inside the company too, and
      // discarding them here would throw away what the switch demonstrates.
      setFindings((current) =>
        findingsInScope(current, rules, threads[next].recipientKind),
      );
    },
    [mode, rules, threads],
  );

  /** A click on an example reply or on the ghost hint. Scans with no debounce. */
  const handleInsert = useCallback(
    (text: string) => {
      immediate.current = true;
      noteInteraction();
      setDraft(text);
    },
    [noteInteraction],
  );

  const handleDraftChange = useCallback(
    (next: string) => {
      if (next !== "") noteInteraction();
      setDraft(next);
    },
    [noteInteraction],
  );

  const handleAccept = useCallback(
    (finding: Finding, option: RemediationOption) => {
      // A terms finding has no wording to substitute, so its remedy is deletion.
      const replacement = option.text ?? "";
      const next = applyReplacement(draft, finding, replacement);

      // Discard every finding and re-scan from scratch rather than patching the
      // other findings' offsets (§8.1 step 4). Replacing text shifts every later
      // position, and offset arithmetic across a mutation is a bug factory for no
      // benefit when a re-scan costs 40ms.
      seq.current += 1;
      immediate.current = true;
      setFindings([]);
      setTruncated(false);
      setScanNonce((n) => n + 1);

      // The draft changed between render and click and the text is gone. Abandon
      // silently; the re-scan above is the whole recovery.
      if (next === null) return;
      setDraft(option.text === undefined ? tidySpacing(next) : next);
    },
    [draft],
  );

  const handleKeep = useCallback((finding: Finding) => {
    // Per (rule, exact text), never per occurrence: if the same sentence appears
    // twice, keeping your wording on one card removes both (§8.2). Memory only.
    setSuppressed((current) => new Set(current).add(suppressionKey(finding)));
  }, []);

  /**
   * The counterparty writes back.
   *
   * Two timers, not one: a gap before they start, then the time they spend typing.
   * A single delay would make the indicator appear at the same instant the reply was
   * decided, which is not what waiting on a person looks like.
   *
   * The generation check is what keeps a reply honest. `Reset conversation` and a
   * second send both invalidate the current generation, so a reply that was already
   * scheduled cannot land in a thread that has been reset out from under it.
   */
  const scheduleReply = useCallback(
    async (request: ReplyRequest, inMode: ThreadMode) => {
      // Captured BEFORE the await, not after. A model implementation of `nextReply`
      // will take real time, and a generation read on the far side of that await
      // would be the generation of whatever gesture happened during it, which is
      // exactly the reply this guard exists to drop.
      const generation = replyGeneration.current;
      const reply = await nextReply(request);
      if (reply === null || generation !== replyGeneration.current) return;

      const { beforeMs, typingMs } = replyTimings(reply.text);

      const start = setTimeout(() => {
        if (generation !== replyGeneration.current) return;
        setTypingIn(inMode);

        const land = setTimeout(() => {
          if (generation !== replyGeneration.current) return;
          setTypingIn(null);
          setThreads((current) => ({
            ...current,
            [inMode]: {
              ...current[inMode],
              messages: [
                ...current[inMode].messages,
                {
                  id: `reply-${inMode}-${Date.now()}`,
                  from: reply.from,
                  label: labelFor(inMode, reply.from),
                  time: clockTime(new Date()),
                  text: reply.text,
                },
              ],
            },
          }));
        }, typingMs);
        replyTimers.current.push(land);
      }, beforeMs);
      replyTimers.current.push(start);
    },
    [],
  );

  const handleSend = useCallback(
    (note: string) => {
      const text = draft.trim();
      if (text === "") return;

      noteInteraction();

      // Appends to the thread it was composed in. With one shared thread this was
      // unspecified, and a reply sent internally persisted into the external
      // conversation (F25).
      const sent: Message = {
        id: `sent-${mode}-${Date.now()}`,
        from: "You",
        time: clockTime(new Date()),
        text,
        mine: true,
      };
      const history = [...threads[mode].messages.map((message) => message.text), text];
      setThreads((current) => ({
        ...current,
        [mode]: { ...current[mode], messages: [...current[mode].messages, sent] },
      }));

      seq.current += 1;
      setDraft("");
      setFindings([]);
      setTruncated(false);
      flashClean(false);

      if (note !== "") {
        setNotes((current) => [
          ...current,
          { id: `note-${Date.now()}`, from: "You", time: clockTime(new Date()), text: note },
        ]);
      }

      // Sending does not wait on this. `scheduleReply` is fired and forgotten, and
      // nothing above depends on it resolving.
      clearReplies();
      void scheduleReply(
        {
          sent: text,
          recipientKind: threads[mode].recipientKind,
          from: threads[mode].recipientLabel,
          history,
        },
        mode,
      );
    },
    [draft, mode, threads, flashClean, noteInteraction, clearReplies, scheduleReply],
  );

  const handleReset = useCallback(() => {
    seq.current += 1;
    clearReplies();
    setTypingIn(null);
    setThreads(SEEDED_THREADS);
    setDraft("");
    setFindings([]);
    setTruncated(false);
    setSuppressed(new Set());
    setNotes([]);
    flashClean(false);
  }, [flashClean, clearReplies]);

  /**
   * The pending draft, or nothing at all.
   *
   * It mounts on the first character and unmounts on send, which is what makes the
   * distinction between advice and a record structural rather than stated: while it
   * exists, nothing has been sent. The guidance node is passed as a child and is
   * always mounted while the bubble is, empty or not, because it owns the polite
   * live region and a live region that appears at the same moment as its first
   * content is not reliably announced.
   */
  const pending =
    draft.trim() === "" ? null : (
      <PendingDraft draft={draft} severity={topSeverity} hasGuidance={hasGuidance}>
        <GuidancePanel
          findings={shown}
          rules={rules}
          kind={thread.recipientKind}
          truncated={truncated}
          clean={clean}
          onAccept={handleAccept}
          onKeep={handleKeep}
        />
      </PendingDraft>
    );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col px-4 sm:px-6">
      {/* No channel sidebar: it is the layout signature of specific commercial
          products and it is unnecessary here (T4.1.6). */}
      {/* The header is chrome and nothing else now. What the product is belongs in
          the framing strip below, next to the conversation it is talking about,
          where a new visitor is actually looking. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-6 pb-5 sm:pt-10">
        <p className="text-lg font-semibold tracking-tight text-ink">{COPY.title}</p>
        <nav aria-label="Site" className="flex items-center gap-4 text-sm text-ink-secondary">
          <Link href="/press" className="transition-control hover:text-ink hover:underline">
            Press
          </Link>
          {/* `Rules` means nothing to a first-time visitor, which is why the
              framing strip and every finding also carry a worded way in. It stays
              in the nav for the visitor who already knows what it is. */}
          <Link href="/settings" className="transition-control hover:text-ink hover:underline">
            Rules
          </Link>
          <a
            href="https://github.com/bharathts07/second-thought"
            className="transition-control hover:text-ink hover:underline"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </header>

      <FramingStrip open={framingOpen} onToggle={() => setFramingOpen((open) => !open)} />

      <main className="flex-1 pt-5">
        <Thread
          thread={thread}
          onReset={handleReset}
          typingFrom={typingIn === mode ? thread.recipientLabel : undefined}
          pending={pending}
        >
          <RecipientSwitch mode={mode} onChange={handleSwitch} />
        </Thread>

        {/* The concrete answer to "so how would anyone ever know?": a record can
            exist for the sender without existing for anyone else. Memory only,
            gone on reload, recorded nowhere (T4.7.3). */}
        {notes.length > 0 ? (
          <section className="mt-8 border-t border-hairline pt-4">
            <h2 className="text-sm font-medium text-ink">{COPY.notesHeading}</h2>
            <p className="mt-1 text-xs text-ink-muted">{COPY.notesDisclaimer}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((note) => (
                <li key={note.id} className="text-sm text-ink-secondary">
                  <span className="font-mono text-2xs text-ink-muted">{note.time}</span>{" "}
                  {note.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>

      {/*
        Pinned, and that is the whole reason guidance can attach to the draft.
        The visitor is typing into this field; if it moved when a card arrived, the
        product would be interrupting the sentence it is trying to help with. Sticky
        rather than fixed, so it occupies its own space at the end of the document
        and the conversation above it can scroll to a real bottom. The negative
        margins let its hairline span the column while its content stays aligned
        with everything above it.
      */}
      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-hairline bg-canvas px-4 pt-3 pb-3 sm:-mx-6 sm:px-6 sm:pt-4 sm:pb-4">
        <Composer
          draft={draft}
          mode={mode}
          status={status}
          requestsSinceReady={requestsSinceReady}
          findings={shown}
          onDraftChange={handleDraftChange}
          onInsert={handleInsert}
          onSend={handleSend}
        />
        <p className="mt-3 max-w-reading text-2xs text-ink-muted">{COPY.disclaimer}</p>
      </div>
    </div>
  );
}
