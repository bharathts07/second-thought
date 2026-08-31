/**
 * The guard the press page did not have, and the drift it let through.
 *
 * Every component that carries user-visible copy has a tone test: `Landing`,
 * `FindingCard` and `Composer` each keep their own off-limits list. The press page
 * carries more prose than all three together and had none, so four banned strings
 * were live on it at once: "you should not" in section 02, "the device" in the
 * callout, "network requests" in the telemetry list, and "threshold" under the
 * rules table. A reviewer reading in a browser found them; no test could have.
 *
 * The interesting rule here is the one the product surface does not need. Press is
 * the one place technical vocabulary is allowed, because a reader who wants proof
 * has to be able to get it, but only inside the section explicitly labelled "How it
 * works" and never in a heading or a lead. So the assertions below are per section
 * rather than per page, which is why this file bothers to cut the markup into
 * sections instead of flattening it into one string.
 *
 * `@testing-library/react` is not installed and may not be installed, so this uses
 * `renderToStaticMarkup`, as every other test here does. The page is a synchronous
 * server component, so that works with no DOM and no Next runtime.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PressPage from "./page";

const markup = () => renderToStaticMarkup(<PressPage />);

/** Tags out, entities back, so an assertion reads the sentence a person reads. */
const text = (fragment: string) =>
  fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Band elements with their background tone extracted from the class attribute.
 * Bands provide the visual rhythm and section boundaries, replacing numbered
 * editorial furniture.
 */
const bands = (rendered: string) =>
  Array.from(
    rendered.matchAll(/<(section|div)[^>]*class="([^"]*\b(?:bg-surface|bg-tint)\b[^"]*)"/g),
  ).map((m) => ({
    element: m[1],
    tone: m[2].includes("bg-tint") ? "tint" : "paper",
  }));

/**
 * Section headings (h2 elements) in document order.
 */
const headings = (rendered: string) =>
  Array.from(
    rendered.matchAll(/<h2\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g),
  ).map((m) => ({ id: m[1], text: text(m[2]) }));

/**
 * The sections, in document order, keyed by the id their heading carries.
 */
const sections = (rendered: string) =>
  Array.from(
    rendered.matchAll(/<section[^>]*aria-labelledby="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g),
  ).map((m) => ({ id: m[1], body: m[2] }));

/** Everything that is NOT inside a Band section. */
const outsideSections = (rendered: string) =>
  rendered.replace(/<section[^>]*aria-labelledby="[^"]+"[^>]*>[\s\S]*?<\/section>/g, " ");

describe("press: band alternation", () => {
  it("has multiple bands with alternating tones", () => {
    const found = bands(markup());

    expect(found.length).toBeGreaterThan(3);

    // Check that bands alternate (allowing for the first Band which wraps the intro)
    for (let i = 1; i < found.length - 1; i++) {
      expect(
        found[i].tone !== found[i + 1].tone,
        `Band ${i} and Band ${i + 1} should have different tones`,
      ).toBe(true);
    }
  });

  it("has section headings for each major section", () => {
    const found = headings(markup());

    // At least 5 major sections after the title
    expect(found.length).toBeGreaterThanOrEqual(5);

    // Key sections must exist
    const ids = found.map((h) => h.id);
    expect(ids).toContain("how-it-works-heading");
    expect(ids).toContain("why-local-heading");
    expect(ids).toContain("the-rules-heading");
  });
});

describe("press: every heading a section points at exists", () => {
  it("resolves each aria-labelledby to a real heading id", () => {
    const rendered = markup();

    for (const { id } of sections(rendered)) {
      // The aria-labelledby should point to an h2 with that id
      expect(rendered).toContain(`id="${id}"`);
    }
  });

  it("names no in-page anchor that has no heading to land on", () => {
    const rendered = markup();
    const fragments = Array.from(rendered.matchAll(/href="#([^"]+)"/g)).map((m) => m[1]);

    for (const fragment of fragments) {
      expect(rendered).toContain(`id="${fragment}"`);
    }
  });
});

/**
 * The same list the three component tone tests carry. Duplicated rather than
 * shared, deliberately: a single exported list is the kind of thing someone edits
 * to make a test pass, and each of these files is meant to be readable on its own.
 */
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
  "offence",
  "misconduct",
];

describe("press: tone", () => {
  it("never reaches for a word that implies fault", () => {
    const body = text(markup()).toLowerCase();

    for (const word of OFF_LIMITS) {
      expect(body).not.toContain(word);
    }
  });

  it("claims noticing rather than preventing or guaranteeing", () => {
    // The page may quote a draft that over-promises, and the disclaimer has to be
    // able to say the product does not ensure compliance, so this checks the
    // affirmative claim rather than the bare word.
    const body = text(markup()).toLowerCase();

    expect(body).not.toContain("ensures compliance");
    expect(body).not.toContain("prevents");
    expect(body).not.toContain("guarantees that");
  });

  it("uses no em-dash and no double hyphen anywhere a reader can see", () => {
    const body = text(markup());

    expect(body).not.toContain("—");
    expect(body).not.toContain("--");
  });
});

/**
 * Plural allowed, stem not: `\bmodel\b` misses "models", and a ban a plural walks
 * through is not a ban. Spaces are `\s+` because a phrase can break across lines.
 *
 * "device" is the one entry that cannot be the bare noun. What is banned is the
 * jargon sense, the reader's own machine called "the device", and section 05 quotes
 * §87(1)(6) BetrVG, whose subject in every English rendering is "technical devices
 * for monitoring". Banning the noun outright would force a wrong translation of a
 * statute to satisfy a lint, so the pattern asks for the possessive sense instead.
 */
const MACHINERY = [
  /\bwebgpu\b/,
  /\bwasm\b/,
  /\bwebassembly\b/,
  /\bmodels?\b/,
  /\bembeddings?\b/,
  /\bsemantic(ally)?\b/,
  /\bthresholds?\b/,
  /\bconfidence\s+scores?\b/,
  /\binference\b/,
  /\bvectors?\b/,
  /\b(your|the|this)\s+(own\s+)?device\b/,
  /\bon[-\s]device\b/,
  /\bnetwork\s+requests?\b/,
  /\bpattern\s+checks\b/,
];

/** The one section allowed to name the machinery, by the heading a reader sees. */
const DISCLOSURE = "how-it-works-heading";

describe("press: where the machinery may be named", () => {
  it("keeps it out of every section except How it works", () => {
    for (const { id, body } of sections(markup())) {
      if (id === DISCLOSURE) continue;
      const prose = text(body).toLowerCase();

      for (const term of MACHINERY) {
        expect(
          term.test(prose),
          `${term} appears in section "${id}", which is not the disclosure`,
        ).toBe(false);
      }
    }
  });

  it("keeps it out of the header, the eyebrow and the lead", () => {
    const prose = text(outsideSections(markup())).toLowerCase();

    for (const term of MACHINERY) {
      expect(term.test(prose), `${term} appears above the first section`).toBe(false);
    }
  });

  it("keeps it out of every heading, including inside How it works", () => {
    const rendered = markup();
    const headings = Array.from(
      rendered.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/g),
    ).map((m) => text(m[1]).toLowerCase());

    expect(headings.length).toBeGreaterThan(1);
    for (const heading of headings) {
      for (const term of MACHINERY) {
        expect(term.test(heading), `${term} appears in heading "${heading}"`).toBe(false);
      }
    }
  });

  it("labels the disclosure in plain words, so a reader knows what they opened", () => {
    expect(text(markup())).toContain("How it works");
  });
});

/**
 * The legal paragraph, pinned to dates rather than to prose.
 *
 * This page said the 2022 NLRB monitoring guidance was "rescinded in 2026". It was
 * rescinded in February 2025, by GC 25-05. Two review passes had already approved
 * that sentence, because both compared it against the spec that carried the error
 * instead of against a source, which is the whole lesson: a check that reads only our
 * own documents is not a check.
 *
 * `content-safety.md` §4 asks for enforcement guidance to carry its date and its
 * current status, never a bare present tense, because guidance is rescinded and
 * reinstated with administrations. These assertions are the cheap half of that rule.
 * The expensive half, re-verifying against the source at publish time, is a checklist
 * step no test can perform; that verification and its date live in `build-log.md`.
 */
describe("the press page's legal paragraph", () => {
  const legal = () => text(markup());

  it("dates the rescission to February 2025, which is when it happened", () => {
    expect(legal()).toContain("rescinded in February 2025");
  });

  it("never says 2026, the date that was wrong and shipped anyway", () => {
    expect(legal()).not.toContain("rescinded in 2026");
  });

  it("attributes the works-council trigger to case law, not to the statute's text", () => {
    const body = legal();
    expect(body).toContain("BetrVG");
    // The statute says "dazu bestimmt". That capability rather than intent is the
    // trigger is a BAG construction, so stating it as statutory text misattributes it.
    expect(body.toLowerCase()).toContain("case law");
  });

  it("keeps the data-protection point conditional rather than categorical", () => {
    // "is high risk" would assert the conclusion of a test the law leaves open.
    expect(legal()).toMatch(/likely|normally|treat/i);
  });

  it("frames the reasoning as being about this product, never about anyone's legality", () => {
    const body = legal().toLowerCase();
    for (const claim of ["is unlawful", "is illegal", "breaks the law", "violates the"]) {
      expect(body, claim).not.toContain(claim);
    }
  });
});
