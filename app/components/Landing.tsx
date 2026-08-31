/**
 * The landing page above the seam: introduction to the product for a new visitor.
 *
 * Six parts, in order: hero, 01 (nobody sets out to break a rule), 02 (it works for
 * you, not on you), 03 (a note in the margin), 04 (the demo, the seam itself), and
 * 05 (you do not have to take our word for it). The hero carries no numeral;
 * editorial sections are 01 to 05.
 *
 * **Brand register above the seam, product register below it.** The two halves use
 * different typefaces, and the change happens at the seam where the argument stops
 * and the visitor is handed the working thing. The landing prose is serif, the same
 * face `/press` already uses; the live product keeps the system stack it has today.
 * That way the type changes at exactly the moment the page says "you have stopped
 * reading and started using" without a word of instruction.
 *
 * **The design language is called Marginalia.** A second thought is a margin note you
 * write to yourself before you send. Paper ground, one annotation blue used only for
 * marks and state, hairline margin rules, numbered editorial sections, and the pause
 * (an ellipsis) as the recurring motif. Use those words in comments.
 *
 * **What Marginalia forbids on top of the absolute bans:** no icon per section, no
 * illustration of an abstract noun, no card grid standing in for an argument, no
 * floating UI screenshot on an angle, no gradient anywhere. The ONLY thing allowed to
 * be visually large is a section numeral.
 *
 * **Content safety constraints** (these are not style choices, they are binding to
 * avoid risk to any company):
 *   - No logo wall, no customer count, no testimonial, no named company anywhere
 *   - No analyst mention, award, certification, or "trusted by"
 *   - No invented metric, and NO accuracy or precision figure at all: none has been
 *     measured
 *   - The only permitted numbers are the two measured cosine scores already on
 *     `/press`, and section numerals
 *   - Every domain is example.com; never acme, contoso, northwind
 *
 * **Structural responsiveness, not fluid type.** Usable at 390px. Vary the vertical
 * rhythm between sections rather than using one uniform pad, because uniform spacing
 * is what made earlier passes read unfinished.
 */

import Link from "next/link";
import type { ReactNode } from "react";
import { ReadingMark, NoteMark, ChoiceMark } from "./Marks";

/** Copy transcribed from the spec. Checked against the banned list. */
const COPY = {
  wordmark: "Second Thought",
  h1: "A second thought, before you hit send.",
  lead:
    "Your company has rules about what you can promise, what you can share, and how you talk to " +
    "people. When someone is waiting, they are easy to cross without noticing. Second Thought " +
    "reads your draft on your own computer, points out the line that could cause trouble, and " +
    "offers a safer way to say it.",
  primaryCta: "Try it",
  secondaryCta: "Read the press release",
  privacyNote: "It runs on your computer. Nobody else sees what you type.",

  section01Heading: "Nobody sets out to break a rule",
  section01P1:
    "A customer is waiting. You have three minutes before your next meeting. You write one " +
    "sentence that crosses a line, and nobody notices. It might be a promise your company cannot " +
    "stand behind, a price or date you cannot commit to, a sharp word about a colleague, or an " +
    "offer to move the conversation somewhere it will not be recorded.",
  section01P2:
    "Months later that sentence is the thing being quoted back, in a room where nobody " +
    "remembers the context and the person who typed it may not even work there any more.",
  section01P3:
    "The rule you broke usually already existed. It was in a policy document, which is a fine " +
    "place for a rule and the wrong place for it at the moment you are typing. Nobody opens a " +
    "policy document mid-sentence.",

  section02Heading: "It works for you, not on you",
  section02P1:
    "The person who gets in trouble is the person who typed the sentence. Almost everything in " +
    "this space is built for the employer and reviews messages after they are sent. This is " +
    "built for the person writing, before.",
  section02P2:
    "It runs on your own machine. There is no console showing anyone what you wrote, no " +
    "reporting on anyone, nothing kept. It never blocks a message, because the person sending " +
    "it is the one who decides.",
  section02P3:
    "And the rule set deliberately does not look at pay, hours, working conditions or " +
    "organising, which is enforced in code rather than promised in prose. Protecting the " +
    "employer and protecting the employee are the same job here, and the employee is the one " +
    "standing closest to the risk.",

  section03Heading: "A note in the margin, before you send",
  section03P1:
    "Three moves. When a sentence could cause trouble, guidance appears attached to the words " +
    "it is about, with a way to say it that keeps your meaning.",
  section03Move1Title: "It reads the draft as you type",
  section03Move1Body: "On your own computer, as you write. There is nothing to turn on and nothing to send off.",
  section03Move2Title: "It puts the note under the sentence",
  section03Move2Body:
    "When a sentence could cause trouble, guidance appears attached to the words it is about, " +
    "with a way to say it that keeps your meaning.",
  section03Move3Title: "You decide",
  section03Move3Body:
    "Take the suggested wording or keep your own. It never blocks a message, and it never tells " +
    "anyone what you wrote.",

  section04Heading: "Try it",
  section04Seam:
    "That is the argument. This is the working thing, running here in this page. Answer Sam's " +
    "question, and watch what happens when you promise something specific.",
  section04Harness:
    "This conversation is a demo surface built to show the checker. The intended form is an " +
    "extension for the tools your team already use.",

  section05Heading: "You do not have to take our word for it",
  section05P1:
    "Let the page finish getting ready, then turn your network off and keep typing. The checking " +
    "keeps working, because the checker is already on your machine and there is no server that " +
    "could receive a draft.",
  section05Eyebrow: "What it does not do",
  section05Limit1:
    "It never stops you sending anything. It is advisory, and every note can be dismissed.",
  section05Limit2:
    "Its accuracy has not been measured yet. The rules are tuned by judgement rather than by " +
    "evidence, and we will not publish a number we have not earned.",
  section05Limit3:
    "Eight rules, and they are a demonstration of the idea rather than a compliance programme. " +
    "They cover what you can promise about security and data residency, delivery dates, pricing " +
    "and discounts, moving a conversation somewhere unrecorded, personal criticism of a " +
    "colleague, and strong language.",
  section05Limit4: "English only, one surface, and no console, no telemetry, no reporting on anyone.",

  disclaimer:
    "Second Thought is a drafting aid. It does not provide legal or compliance advice and " +
    "does not ensure compliance with any law, regulation, or company policy.",
} as const;

/**
 * A section numeral. The only number that is allowed to be large anywhere on this
 * page. Editorial documents number their sections; this is an editorial landing page.
 * Muted rather than primary ink, so the numeral marks structure without shouting.
 */
function SectionNumeral({ children }: { children: ReactNode }) {
  return (
    <div
      className="font-mono text-4xl font-medium tabular-nums text-ink-muted"
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/**
 * A margin rule: hairline separation between sections. Used only for structure, never
 * decoration. Part of the Marginalia vocabulary.
 */
function MarginRule() {
  return <hr className="border-t border-hairline" />;
}

/**
 * The hero artifact: a static typeset figure showing one real note, rendered in the
 * product's own type, paper, and annotation ink. This exists to pass the glance test
 * by showing the actual artifact at the moment the visitor arrives, before the live
 * demo has downloaded.
 *
 * Static markup only, no engine, no hooks, no state. The choices are not focusable
 * and not interactive, because this is an example.
 *
 * ONE BORDERED SURFACE: the figure itself has the border. The draft line and note
 * are separated by a hairline margin rule, not by nested bordered boxes.
 *
 * THE ATTACHMENT MARK: a hairline drops from the underlined phrase to the note below
 * it, in the annotation ink, showing that the note belongs to THAT phrase. This is
 * the single most important spatial relationship in the product.
 */
function HeroArtifact() {
  return (
    <figure
      className="flex flex-col rounded-lg border border-severity-high-edge bg-surface"
      aria-label="Example of Second Thought showing a note attached to a sentence that over-promises"
    >
      {/* Caption: quiet and small, reads "Example" */}
      <figcaption className="px-4 pt-3 pb-2 text-xs text-ink-muted">
        Example
      </figcaption>

      {/* The draft line with label and flagged phrase */}
      <div className="flex flex-col gap-1 px-4 pb-3">
        <p className="text-xs text-ink-muted">What you wrote</p>
        <div className="relative">
          <p className="text-base text-ink">
            Yes,{" "}
            <span
              id="flagged-phrase"
              className="bg-severity-high-wash underline decoration-severity-high-edge decoration-1 underline-offset-2"
            >
              we guarantee your data never leaves the US
            </span>
            .
          </p>
          {/* Attachment mark: a hairline descending from the marked phrase into the
              note, which is what makes the note visibly belong to the phrase rather
              than merely sit under it. aria-hidden because "What you wrote" and
              "Worth a second thought" already carry the relationship in words.

              Anchored at `left-0`, the text column's edge, and NOT at the end of the
              underline. Anchoring to the phrase's end was tried and measured wrong:
              `left-[calc(100%-2px)]` resolves to the right edge of the CONTAINER, not
              of the inline span, so on a phrase that wraps to two lines the mark
              landed out at x=958 against the figure's border, reading as a stray tick
              with nothing to do with the sentence. An inline span's end is not a
              stable thing to hang geometry off: it moves with every reflow and every
              font fallback. The column edge does not move, and a rule in the margin is
              the Marginalia gesture anyway. */}
          <svg
            className="absolute left-0 top-full text-severity-high-edge"
            width="1"
            height="12"
            viewBox="0 0 1 12"
            fill="none"
            aria-hidden="true"
          >
            <line
              x1="0.5"
              y1="0"
              x2="0.5"
              y2="12"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>

      {/* Hairline margin rule separating draft from note */}
      <hr className="border-t border-hairline" />

      {/* The note: guidance attached to the draft line as one connected surface */}
      <div className="flex flex-col gap-rhythm-stack p-4">
        {/* Eyebrow */}
        <p className="text-xs font-medium uppercase tracking-label text-ink-muted">
          Worth a second thought
        </p>

        {/* Severity chip: always with the word, never colour alone */}
        <div className="flex items-center gap-rhythm-inline">
          <span className="inline-flex items-center rounded-full bg-severity-high-quiet px-2 py-1 text-2xs font-medium text-severity-high">
            High
          </span>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-ink">
          An unconditional promise about where data is stored
        </h3>

        {/* Suggested wording */}
        <div className="flex flex-col gap-rhythm-stack-tight">
          <p className="text-sm text-ink-secondary">
            Our data-residency options depend on your deployment and contract
            terms. I can put you in touch with our security team for the
            specifics.
          </p>
        </div>

        {/* Two choices, equal weight, depicted not clickable. Hairline underlines
            replace button chrome to read as marked text rather than controls. */}
        <div className="flex items-center gap-4 pt-rhythm-stack-tight">
          <span className="text-sm font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2">
            Use this
          </span>
          <span className="text-sm font-medium text-ink underline decoration-hairline decoration-1 underline-offset-2">
            Keep mine
          </span>
        </div>
      </div>
    </figure>
  );
}

export function Landing({ demoSlot }: { demoSlot: ReactNode }) {
  return (
    <div className="flex flex-col">
      {/* Hero: no section numeral. Two columns at >=1024px (words left, artifact
          right), stacking below 1024px. The artifact must stay legible at 390px.
          Using widened layout tokens for breathing room. */}
      <section className="flex flex-col gap-rhythm-section py-12 sm:py-16">
        <div className="flex flex-col gap-rhythm-section lg:grid lg:grid-cols-2 lg:items-start lg:gap-12">
          {/* Left column: the words */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              {/* No `whitespace-nowrap`. It was added to keep the wordmark on one line
                  at 1280 and it measurably broke the layout instead: the hero column is
                  328px there and the wordmark needs about 330px at this size, so forcing
                  one line pushed it to x=643 with the artifact starting at 650, close
                  enough to read as a collision. Wrapping to two lines at 1280 and
                  sitting on one at 1440 is the correct responsive behaviour, and a
                  two-line wordmark was never the defect. */}
              <h1 className="font-serif text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                {COPY.wordmark}
              </h1>
              <p className="font-serif text-2xl font-medium text-ink sm:text-3xl">
                {COPY.h1}
              </p>
              <p className="max-w-reading font-serif text-lg text-ink-secondary sm:text-xl">
                {COPY.lead}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="#try"
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas transition-control hover:bg-accent-strong"
              >
                {COPY.primaryCta}
              </a>
              <Link
                href="/press"
                className="rounded-md border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink transition-control hover:border-control hover:bg-raised"
              >
                {COPY.secondaryCta}
              </Link>
            </div>
            <p className="text-sm text-ink-muted">{COPY.privacyNote}</p>
          </div>

          {/* Right column: the artifact */}
          <div className="lg:sticky lg:top-8">
            <HeroArtifact />
          </div>
        </div>
      </section>

      <MarginRule />

      {/* Section 01: the problem, broadened beyond over-promising. Serif prose in
          brand register. */}
      <section className="flex flex-col gap-6 py-rhythm-section">
        <div className="flex items-start gap-4 sm:gap-6">
          <SectionNumeral>01</SectionNumeral>
          <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {COPY.section01Heading}
          </h2>
        </div>
        <div className="flex max-w-reading flex-col gap-4 font-serif text-base text-ink-secondary sm:text-lg">
          <p>{COPY.section01P1}</p>
          <p>{COPY.section01P2}</p>
          <p>{COPY.section01P3}</p>
        </div>
      </section>

      <MarginRule />

      {/* Section 02: NEW - it works for you, not on you. The most important section.
          This is what makes the product different: it protects the employee first,
          runs on their machine, never reports on anyone, and deliberately excludes
          labor relations. Still brand register, serif prose. */}
      <section className="flex flex-col gap-6 py-rhythm-section">
        <div className="flex items-start gap-4 sm:gap-6">
          <SectionNumeral>02</SectionNumeral>
          <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {COPY.section02Heading}
          </h2>
        </div>
        <div className="flex max-w-reading flex-col gap-4 font-serif text-base text-ink-secondary sm:text-lg">
          <p>{COPY.section02P1}</p>
          <p>{COPY.section02P2}</p>
          <p>{COPY.section02P3}</p>
        </div>
      </section>

      <MarginRule />

      {/* Section 03: how it works. Three numbered moves, still brand register.
          Each move has a mechanism mark showing the mechanism itself. */}
      <section className="flex flex-col gap-6 py-rhythm-block">
        <div className="flex items-start gap-4 sm:gap-6">
          <SectionNumeral>03</SectionNumeral>
          <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {COPY.section03Heading}
          </h2>
        </div>
        <p className="max-w-reading font-serif text-base text-ink-secondary sm:text-lg">
          {COPY.section03P1}
        </p>
        <ol className="flex max-w-reading flex-col gap-5">
          <li className="flex gap-4">
            <span className="shrink-0 font-mono text-lg font-medium tabular-nums text-accent">
              1.
            </span>
            <ReadingMark />
            <div className="flex flex-col gap-1">
              <p className="font-serif text-base font-semibold text-ink">
                {COPY.section03Move1Title}
              </p>
              <p className="font-serif text-base text-ink-secondary">
                {COPY.section03Move1Body}
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="shrink-0 font-mono text-lg font-medium tabular-nums text-accent">
              2.
            </span>
            <NoteMark />
            <div className="flex flex-col gap-1">
              <p className="font-serif text-base font-semibold text-ink">
                {COPY.section03Move2Title}
              </p>
              <p className="font-serif text-base text-ink-secondary">
                {COPY.section03Move2Body}
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="shrink-0 font-mono text-lg font-medium tabular-nums text-accent">
              3.
            </span>
            <ChoiceMark />
            <div className="flex flex-col gap-1">
              <p className="font-serif text-base font-semibold text-ink">
                {COPY.section03Move3Title}
              </p>
              <p className="font-serif text-base text-ink-secondary">
                {COPY.section03Move3Body}
              </p>
            </div>
          </li>
        </ol>
      </section>

      <MarginRule />

      {/* Section 04: the seam. This is where brand register ends and product
          register begins. The argument stops, the demo starts, and the typeface
          changes under the reader. Rules pointer removed: now reachable from the
          composer itself. */}
      <section className="flex flex-col gap-6 py-rhythm-page">
        <div id="try" className="flex items-start gap-4 sm:gap-6">
          <SectionNumeral>04</SectionNumeral>
          <h2 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">
            {COPY.section04Heading}
          </h2>
        </div>
        <div className="flex max-w-reading flex-col gap-4">
          <p className="font-serif text-base text-ink-secondary sm:text-lg">
            {COPY.section04Seam}
          </p>
          <p className="text-sm text-ink-muted">{COPY.section04Harness}</p>
        </div>

        {/* The demo slot. The live product, exactly the components that are there
            today: recipient switch, thread, pending draft with guidance, composer
            and status line. The type changes here from serif to system stack. */}
        <div>{demoSlot}</div>
      </section>

      <MarginRule />

      {/* Section 05: the limits. What it does not do. Still product register.
          Broadened to match the new positioning: covers all eight rules, not just
          over-promising. */}
      <section className="flex flex-col gap-6 py-rhythm-section">
        <div className="flex items-start gap-4 sm:gap-6">
          <SectionNumeral>05</SectionNumeral>
          <h2 className="text-2xl font-semibold text-ink sm:text-3xl">
            {COPY.section05Heading}
          </h2>
        </div>
        <div className="flex max-w-reading flex-col gap-5">
          <p className="text-base text-ink-secondary sm:text-lg">
            {COPY.section05P1}
          </p>
          <div className="flex flex-col gap-4">
            <p className="text-xs font-medium uppercase tracking-label text-ink-muted">
              {COPY.section05Eyebrow}
            </p>
            <ul className="flex flex-col gap-3 text-sm text-ink-secondary">
              <li className="flex gap-2">
                <span className="shrink-0" aria-hidden="true">
                  -
                </span>
                <span>{COPY.section05Limit1}</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0" aria-hidden="true">
                  -
                </span>
                <span>{COPY.section05Limit2}</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0" aria-hidden="true">
                  -
                </span>
                <span>{COPY.section05Limit3}</span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0" aria-hidden="true">
                  -
                </span>
                <span>{COPY.section05Limit4}</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <MarginRule />

      {/* Footer: disclaimer and links. */}
      <footer className="flex flex-col gap-4 py-8">
        <nav aria-label="Site" className="flex flex-wrap items-center gap-4 text-sm">
          <Link
            href="/press"
            className="text-ink-secondary underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control"
          >
            Press
          </Link>
          <Link
            href="/settings"
            className="text-ink-secondary underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control"
          >
            Rules
          </Link>
          <a
            href="https://github.com/bharathts07/second-thought"
            className="text-ink-secondary underline decoration-hairline underline-offset-2 transition-control hover:text-ink hover:decoration-control"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
        <p className="max-w-reading text-2xs text-ink-muted">{COPY.disclaimer}</p>
      </footer>
    </div>
  );
}
