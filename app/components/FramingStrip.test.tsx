/**
 * What the framing strip owes the first five seconds, and what it owes the fold.
 *
 * This file exists because the strip lost height under measurement: open at
 * 1280x800 it spent 254px and five stacked blocks before the product started, so
 * the field the visitor is meant to type into was cut in half by the fold. The
 * height came back out of copy and spacing rather than out of content, and the
 * tests below are the guard on that distinction. Anything that would be cheaper
 * to delete than to shorten is asserted here: the lead line at its larger size,
 * the privacy sentence visible with no interaction, a way to reach the rules, and
 * the honest note that this is a demo.
 *
 * `@testing-library/react` is not installed and this task may not install it, so
 * there is no click simulation. `renderToStaticMarkup` needs no DOM and carries
 * everything asserted here. What is NOT covered: that the toggle actually calls
 * `onToggle`. That is one line of wiring, visible in the source.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FramingStrip } from "./FramingStrip";

const noop = () => {};

const openMarkup = () => renderToStaticMarkup(<FramingStrip open onToggle={noop} />);
const closedMarkup = () =>
  renderToStaticMarkup(<FramingStrip open={false} onToggle={noop} />);

/** Tags out, entities back, so an assertion reads the sentence a person reads. */
const text = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, "")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/** Every top-level paragraph of the open strip, in document order. */
const paragraphs = (markup: string) =>
  Array.from(markup.matchAll(/<p\b[^>]*>(.*?)<\/p>/g)).map((m) => text(m[1]));

describe("FramingStrip, open: what must survive", () => {
  it("leads with the answer to what this is, and keeps it at the larger size", () => {
    const markup = openMarkup();

    expect(text(markup)).toContain(
      "Your company has rules about what you can promise a customer.",
    );
    // `text-md` is 18px against the 14.2px body under it. The strip needs a top
    // line rather than four paragraphs of equal weight, and shrinking the lead is
    // the tempting way to buy height that would cost the thing height was bought
    // for.
    expect(markup).toMatch(/<p class="[^"]*\btext-md\b[^"]*">Your company has rules/);
  });

  it("states the privacy claim with no interaction required", () => {
    // The entire trust argument, and it is worth nothing behind a disclosure.
    expect(text(openMarkup())).toContain(
      "It all happens on your computer. Nothing you type is sent anywhere.",
    );
  });

  it("offers a way to reach the rules, inside the privacy sentence's block", () => {
    const markup = openMarkup();

    // One block, not two. A lone paragraph whose only content was this link cost
    // a line box and a block gap to say nothing the sentence above it could not
    // carry, and it read as a footnote to a footnote.
    expect(markup).toMatch(
      /<p[^>]*>It all happens on your computer\. Nothing you type is sent anywhere\. <a [^>]*href="\/settings"[^>]*>See the rules it checks against<\/a>\.<\/p>/,
    );
  });

  it("admits what it is: a demo, with the real form named", () => {
    const body = text(openMarkup());

    expect(body).toContain("This is a demo of the checker.");
    expect(body).toContain("The intended form is an extension");
  });
});

describe("FramingStrip, open: what it no longer spends", () => {
  it("is four blocks: the lead, then three", () => {
    // The measured defect was five stacked blocks before the product started. The
    // count is the invariant, because the cheapest regression here is a new
    // paragraph that seems free and is 29px.
    expect(paragraphs(openMarkup())).toHaveLength(4);
  });

  it("stops narrating the two buttons before the visitor can see them", () => {
    const body = text(openMarkup());

    // "Take it or keep your own words" was the third sentence of the task
    // paragraph. The two buttons say it themselves, at the moment it matters, in
    // the guidance that is not on screen yet when this paragraph is read.
    expect(body).not.toContain("Take it or keep your own words");
    expect(body).toContain(
      "you will see a note under it with a better way to say it.",
    );
  });

  it("lets the demo note set on one line by not capping it to the reading measure", () => {
    const markup = openMarkup();

    // Measured: the note needs 556px and the 68ch measure hands it 541, so the
    // measure was buying a second line for fifteen pixels. A measure protects the
    // eye's return to the start of the next line; a line that does not wrap has no
    // next line. The other three paragraphs keep the measure, and this asserts the
    // exception did not spread.
    expect(markup).toMatch(/<p class="text-xs text-ink-muted">This is a demo/);
    expect(markup.match(/max-w-reading/g)).toHaveLength(3);
  });
});

describe("FramingStrip, collapsed", () => {
  it("keeps only the way to the rules and the way back", () => {
    const body = text(closedMarkup());

    expect(body).toContain("See the rules it checks against");
    expect(body).toContain("What is this?");
    // Repeating the pitch in miniature is the nag the collapse exists to remove.
    expect(body).not.toContain("Your company has rules");
    expect(body).not.toContain("Answer the question below");
  });

  it("wires the toggle to the body it controls in both states", () => {
    expect(openMarkup()).toContain('aria-expanded="true"');
    expect(closedMarkup()).toContain('aria-expanded="false"');

    const markup = openMarkup();
    const controls = markup.match(/aria-controls="([^"]+)"/);
    expect(controls).not.toBeNull();
    expect(markup).toContain(`id="${controls![1]}"`);
  });
});

describe("FramingStrip: tone", () => {
  // The user has not done anything wrong yet, and that single fact governs the
  // copy. Shortening a paragraph is the moment a sharper word gets in.
  const OFF_LIMITS = [
    "violation",
    "breach",
    "illegal",
    "non-compliant",
    "error",
    "warning",
    "alert",
    "blocked",
    "prevented",
    "forbidden",
    "you must",
    "you should not",
    "risk score",
  ];

  it("never reaches for a word that implies fault", () => {
    const body = `${text(openMarkup())} ${text(closedMarkup())}`.toLowerCase();

    for (const word of OFF_LIMITS) {
      expect(body).not.toContain(word);
    }
  });

  it("claims noticing rather than preventing or guaranteeing", () => {
    const body = text(openMarkup()).toLowerCase();

    expect(body).not.toContain("guarantee");
    expect(body).not.toContain("ensure");
    expect(body).not.toContain("prevent");
  });
});
