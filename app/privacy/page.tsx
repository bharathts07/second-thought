"use client";

/**
 * `/privacy`: What this product does and does not do with what you type.
 *
 * Extracted from the settings page (where it was one section among four) onto
 * its own route, because privacy is a top-level concern and a reader who
 * arrives here first should not have to hunt for it in a settings panel.
 *
 * The page is structured for a worried person: lead with the strongest claim
 * (nothing leaves the machine), then the honest detail about what IS kept
 * locally, then the design reasoning that makes "works for you, not on you"
 * literally true rather than marketing copy.
 *
 * CRITICAL, per `content-safety.md` §7 and F14: every sentence on this page
 * must be literally true of what the code actually does. A privacy string once
 * said "nothing you type is stored anywhere" while the settings page wrote
 * user-typed rule exemplars to IndexedDB, which a reviewer could falsify in
 * two clicks. Check each claim against the code before writing it.
 *
 * Current state (verified against the codebase, 2026-08-30):
 *   - No localStorage writes
 *   - No IndexedDB writes
 *   - Model files ARE cached by the browser (via @huggingface/transformers)
 *   - Everything else (drafts, findings, switches) lives in memory only
 */

import { Band } from "@/app/components/Band";
import { SiteNav } from "@/app/components/SiteNav";

const COPY = {
  title: "Privacy",
  subtitle:
    "What this product does with what you type, where it goes, and who can see it.",

  // Section 1: The strongest claim, first
  neverLeavesHeading: "Nothing you type leaves this machine",
  neverLeaves:
    "Messages you draft are never stored and never sent anywhere. There is no server " +
    "that could receive them, no account to sign into, and no service that processes " +
    "your words. The check runs entirely in your browser, on your own computer.",
  yourComputer:
    "When you close the tab, every draft and every note is gone. There is nothing to " +
    "export, nothing to request, and nothing to hand over.",

  // Section 2: What IS kept locally
  whatIsKeptHeading: "What is kept, and where",
  whatIsKept:
    "The product does keep three kinds of information locally, in your browser. None " +
    "of them are messages you wrote.",
  storageIntro:
    "These are the three storage surfaces the browser provides, and what this product " +
    "uses each one for:",

  // The three surfaces, matched to the settings page but reworded for standalone clarity
  storage: [
    {
      what: "Your preferences",
      where: "Local storage",
      detail:
        "Which rules you have switched off, whether you prefer the page to open with " +
        "guidance visible, and similar settings. Cleared when you clear site data.",
    },
    {
      what: "Rules you write",
      where: "Browser database",
      detail:
        "When rule authoring ships, the rules you create will be kept in this " +
        "browser's IndexedDB and nowhere else. In this version rule authoring is not " +
        "wired up yet, so nothing is written here.",
    },
    {
      what: "The model files",
      where: "Cache storage",
      detail:
        "The wording-check model is a 22MB file that downloads once and stays in your " +
        "browser's cache. This is what makes it possible for every check after the " +
        "first to happen without a network request: the model is already here.",
    },
  ] as const,

  notStoredHeading: "What is never stored at all",
  notStored:
    "The text you write, the findings the product shows you, and any notes you keep " +
    "for yourself are held in memory only. They are gone when you close the tab, and " +
    "they never touch any of the three surfaces above.",

  currentBuildHeading: "In this version",
  currentBuild:
    "This build does not write to local storage or to the database at all. The " +
    "switches on the settings page last until you reload, and nothing else persists. " +
    "Model files are cached by the library that loads them, as described above.",

  // Section 3: Design reasoning (the "works for you, not on you" claim)
  designHeading: "Why the product is built this way",
  designLead:
    "This is a tool that reads your messages before you send them. A tool in that " +
    "position has to earn trust, and the way to earn it is to make privacy claims " +
    "that are verifiable rather than promises you have to take on faith.",

  noTelemetry: "No reporting, no analytics, no telemetry",
  noTelemetryDetail:
    "The product does not phone home. There is no console that shows an administrator " +
    "what anyone typed, no dashboard of flagged messages, and no log of who triggered " +
    "what. If someone is waiting for their draft to become clean before they can send " +
    "it, you are not shown what they wrote.",

  laborExclusion: "Labor topics are excluded by construction",
  laborExclusionDetail:
    "The rule set excludes pay, hours, working conditions, and organizing by design. " +
    "The code that loads rules filters them out before they reach the checker, so " +
    "this is not a policy someone could quietly reverse. The tone and language rules " +
    "also step aside on any sentence that discusses those subjects, so a conversation " +
    "about them is never the thing a note is about.",

  worksForYou:
    "This adds up to the claim the product makes: it works for you, not on you. The " +
    "person who typed the sentence is the person who sees the note. Nobody else does.",

  // Section 4: What this is not
  notComplianceHeading: "What this product is not",
  notCompliance:
    "Second Thought is a drafting aid. It does not provide legal or compliance advice, " +
    "it does not ensure compliance with any law or regulation, and it does not replace " +
    "a lawyer or a compliance officer. The rule set it ships with is a demonstration, " +
    "not a compliance program.",
  notMonitoring:
    "It is also not monitoring. Monitoring tools capture messages that have already " +
    "been sent and make them visible to someone else. This product runs before you " +
    "send, on your own device, and what it shows you is never shown to anyone else.",

  // Section 5: How to clear everything
  clearHeading: "How to clear everything",
  clearDetail:
    "Clearing your browser's site data for this domain removes all three storage " +
    "surfaces at once: preferences, any rules you wrote, and the cached model files. " +
    "The browser's settings panel has a control for this, usually under Privacy or " +
    "Storage.",

  futureNote:
    "When rule authoring ships, the settings page will also have a single-action " +
    "control that clears all three. It is not wired up yet, because an action that " +
    "cleared two of the three would be worth less than an honest absence.",
} as const;

/** Reused panel style from the settings page, for consistency. */
const PANEL = "divide-y divide-hairline rounded-lg border border-hairline bg-surface";

export default function PrivacyPage() {
  return (
    <>
      <SiteNav current="privacy" />

      {/* Band 1: paper - Title and strongest claim */}
      <Band tone="paper" as="section">
        <header className="flex flex-col gap-4 py-6">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {COPY.title}
          </h1>
          <p className="max-w-reading text-md text-ink-secondary">{COPY.subtitle}</p>
        </header>
      </Band>

      {/* Band 2: tint - Nothing leaves the machine */}
      <Band tone="tint" as="section">
        <div className="flex flex-col gap-4 py-rhythm-section">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {COPY.neverLeavesHeading}
          </h2>
          <p className="max-w-reading text-md text-ink">{COPY.neverLeaves}</p>
          <p className="max-w-reading text-md text-ink-secondary">
            {COPY.yourComputer}
          </p>
        </div>
      </Band>

      {/* Band 3: paper - What IS kept locally */}
      <Band tone="paper" as="section">
        <div className="flex flex-col gap-6 py-rhythm-section">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {COPY.whatIsKeptHeading}
            </h2>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.whatIsKept}
            </p>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.storageIntro}
            </p>
          </div>

          <ul className={PANEL}>
            {COPY.storage.map((surface) => (
              <li key={surface.what} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-base font-medium text-ink">{surface.what}</span>
                  <span className="text-sm text-ink-muted">{surface.where}</span>
                </div>
                <p className="max-w-reading text-sm text-ink-secondary">
                  {surface.detail}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-ink">
              {COPY.notStoredHeading}
            </h3>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.notStored}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-ink">
              {COPY.currentBuildHeading}
            </h3>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.currentBuild}
            </p>
          </div>
        </div>
      </Band>

      {/* Band 4: tint - Design reasoning */}
      <Band tone="tint" as="section">
        <div className="flex flex-col gap-6 py-rhythm-section">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {COPY.designHeading}
            </h2>
            <p className="max-w-reading text-md text-ink">{COPY.designLead}</p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-ink">{COPY.noTelemetry}</h3>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.noTelemetryDetail}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-ink">
              {COPY.laborExclusion}
            </h3>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.laborExclusionDetail}
            </p>
          </div>

          <p className="max-w-reading text-md text-ink">{COPY.worksForYou}</p>
        </div>
      </Band>

      {/* Band 5: paper - What this is not */}
      <Band tone="paper" as="section">
        <div className="flex flex-col gap-6 py-rhythm-section">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              {COPY.notComplianceHeading}
            </h2>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.notCompliance}
            </p>
            <p className="max-w-reading text-md text-ink-secondary">
              {COPY.notMonitoring}
            </p>
          </div>
        </div>
      </Band>

      {/* Band 6: tint - How to clear */}
      <Band tone="tint" as="section">
        <div className="flex flex-col gap-4 py-rhythm-section">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {COPY.clearHeading}
          </h2>
          <p className="max-w-reading text-md text-ink-secondary">
            {COPY.clearDetail}
          </p>
          <p className="max-w-reading text-sm text-ink-muted">{COPY.futureNote}</p>
        </div>
      </Band>
    </>
  );
}
