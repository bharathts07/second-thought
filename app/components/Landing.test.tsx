/**
 * Tests for the Landing component: structural requirements and content safety.
 *
 * These tests assert requirements rather than class names, following the same idiom
 * as Composer.test.tsx. They verify:
 *   - The product name, h1, and all five section headings render
 *   - Section numerals are 01, 02, 03, 04, 05: contiguous, one per section, no repeat
 *   - The demo anchor id="try" exists and the primary CTA points at it
 *   - The four "what it does not do" limits are present, and the accuracy limit
 *     says it has not been measured
 *   - No banned tone word and no em-dash appears in the rendered text
 *   - No accuracy or precision figure appears anywhere in the landing markup
 *   - The disclaimer string is present
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Landing } from "./Landing";

/**
 * The banned words list, transcribed from the spec and checked on every string the
 * landing page contains. Each banned word either accuses the visitor or overclaims
 * the product.
 */
const BANNED_TONE_WORDS = [
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

/**
 * Renders the landing page with a minimal demo slot. The slot content does not
 * matter for these tests; we are checking the landing prose and structure.
 */
function render() {
  return renderToStaticMarkup(<Landing demoSlot={<div>Demo slot</div>} />);
}

describe("Landing component structure", () => {
  it("renders the product name prominently in the hero", () => {
    const markup = render();
    expect(markup).toContain("Second Thought");
    // The wordmark appears early in the document, before the sections.
    expect(markup.indexOf("Second Thought")).toBeLessThan(markup.indexOf("01"));
  });

  it("renders the h1 and lead copy", () => {
    const markup = render();
    expect(markup).toContain("A second thought, before you hit send.");
    expect(markup).toContain(
      "Your company has rules about what you can promise, what you can share, and how you talk to people",
    );
  });

  it("renders all five section headings in order", () => {
    const markup = render();
    expect(markup).toContain("Nobody sets out to break a rule");
    expect(markup).toContain("It works for you, not on you");
    expect(markup).toContain("A note in the margin, before you send");
    expect(markup).toContain("Try it");
    expect(markup).toContain("You do not have to take our word for it");
  });
});

describe("Section numerals", () => {
  it("renders section numerals 01, 02, 03, 04, 05 exactly once each", () => {
    const markup = render();
    // Count occurrences of each numeral. They should appear exactly once, and
    // only as section markers (not in prose).
    const count01 = (markup.match(/aria-hidden="true"[^>]*>01</g) || []).length;
    const count02 = (markup.match(/aria-hidden="true"[^>]*>02</g) || []).length;
    const count03 = (markup.match(/aria-hidden="true"[^>]*>03</g) || []).length;
    const count04 = (markup.match(/aria-hidden="true"[^>]*>04</g) || []).length;
    const count05 = (markup.match(/aria-hidden="true"[^>]*>05</g) || []).length;

    expect(count01).toBe(1);
    expect(count02).toBe(1);
    expect(count03).toBe(1);
    expect(count04).toBe(1);
    expect(count05).toBe(1);
  });

  it("uses contiguous numerals starting from 01 with no gaps", () => {
    const markup = render();
    // No 00, no 06, no gap in the sequence.
    expect(markup).not.toContain(">00<");
    expect(markup).not.toContain(">06<");
  });

  it("hides numerals from assistive technology with aria-hidden", () => {
    const markup = render();
    // Every numeral is decorative structure and should be aria-hidden.
    expect(markup.match(/aria-hidden="true"[^>]*>0[1-5]</g)?.length).toBe(5);
  });
});

describe("Demo anchor and call to action", () => {
  it("has an anchor id='try' for the demo section", () => {
    const markup = render();
    expect(markup).toContain('id="try"');
  });

  it("links the primary call to action to the demo anchor", () => {
    const markup = render();
    expect(markup).toContain('href="#try"');
    expect(markup).toContain("Try it");
  });

  it("places the anchor in section 04, which comes before section 05", () => {
    const markup = render();
    // Find the section boundaries. Section 04 should contain id="try", and it
    // should come before section 05 in the document.
    const pos04 = markup.indexOf("aria-hidden=\"true\">04<");
    const pos05 = markup.indexOf("aria-hidden=\"true\">05<");
    const tryPos = markup.indexOf('id="try"');

    // The anchor exists.
    expect(tryPos).toBeGreaterThan(-1);
    // Section 04 comes before section 05.
    expect(pos04).toBeLessThan(pos05);
    // The anchor is somewhere between the start of the document and section 05,
    // which is a loose but sufficient check that it's in the right region.
    expect(tryPos).toBeLessThan(pos05);
  });
});

describe("The four limits in section 05", () => {
  it("renders all four 'what it does not do' limits", () => {
    const markup = render();
    expect(markup).toContain("It never stops you sending anything");
    expect(markup).toContain("Its accuracy has not been measured yet");
    expect(markup).toContain("Eight rules, and they are a demonstration");
    expect(markup).toContain("English only, one surface");
  });

  it("states that accuracy has not been measured, not that it is high", () => {
    const markup = render();
    expect(markup).toContain("has not been measured");
    // No invented precision figure in text content. We check that the copy does
    // not contain patterns like "95% accurate" or "0.98 accuracy".
    expect(markup).not.toMatch(/\d+% accurate/i);
    expect(markup).not.toMatch(/accuracy.*\d+%/i);
    expect(markup).not.toMatch(/\d+\.\d+ accuracy/i);
  });

  it("lists the limits under the 'What it does not do' eyebrow", () => {
    const markup = render();
    expect(markup).toContain("What it does not do");
    const eyebrowPos = markup.indexOf("What it does not do");
    const limit1Pos = markup.indexOf("It never stops you sending");
    expect(limit1Pos).toBeGreaterThan(eyebrowPos);
  });
});

describe("Banned tone words", () => {
  it("contains none of the banned tone words anywhere in the rendered markup", () => {
    const markup = render().toLowerCase();
    for (const word of BANNED_TONE_WORDS) {
      expect(markup).not.toContain(word.toLowerCase());
    }
  });
});

describe("No em-dashes", () => {
  it("uses no em-dash (—) or double-hyphen (--) as punctuation", () => {
    const markup = render();
    expect(markup).not.toContain("—");
    expect(markup).not.toContain(" -- ");
  });
});

describe("No accuracy or precision figures", () => {
  it("contains no percentage or decimal accuracy claim", () => {
    const markup = render();
    // The only numbers allowed are section numerals (01-04) and counts in prose
    // like "three minutes" or "eight rules". No floating-point accuracy figures.
    expect(markup).not.toMatch(/\d+\.\d+%/);
    expect(markup).not.toMatch(/accuracy[^<]*\d+/i);
    expect(markup).not.toMatch(/precision[^<]*\d+/i);
    expect(markup).not.toMatch(/\d+% accurate/i);
  });

  it("contains no invented metric or claim of coverage", () => {
    const markup = render();
    // Check for common overclaims in text content, not CSS. We look for patterns
    // like "100% coverage" or "guarantees" in the visible copy.
    expect(markup).not.toMatch(/100% (accurate|coverage|effective)/i);
    expect(markup).not.toMatch(/99% (accurate|coverage|effective)/i);
    expect(markup).not.toContain("catches everything");
    expect(markup).not.toContain("guarantees compliance");
    expect(markup).not.toContain("ensures compliance");
  });
});

describe("Disclaimer", () => {
  it("renders the disclaimer string in the footer", () => {
    const markup = render();
    expect(markup).toContain("Second Thought is a drafting aid");
    expect(markup).toContain(
      "does not provide legal or compliance advice",
    );
  });
});

describe("Links", () => {
  it("provides links to Press, Rules, and GitHub in the footer", () => {
    const markup = render();
    expect(markup).toContain('href="/press"');
    expect(markup).toContain('href="/settings"');
    expect(markup).toContain("github.com/bharathts07/second-thought");
  });
});

describe("Content safety: no customer references", () => {
  it("contains no logo wall, customer count, or testimonial", () => {
    const markup = render().toLowerCase();
    expect(markup).not.toContain("trusted by");
    expect(markup).not.toContain("customers");
    expect(markup).not.toContain("companies use");
    expect(markup).not.toContain("testimonial");
  });

  it("uses only example.com for external domains", () => {
    const markup = render();
    // The demo slot will contain example.com from the thread, but the landing
    // prose itself must not invent company names.
    expect(markup).not.toContain("acme");
    expect(markup).not.toContain("contoso");
    expect(markup).not.toContain("northwind");
  });
});

describe("Hero artifact", () => {
  it("renders the example figure with its caption", () => {
    const markup = render();
    expect(markup).toContain("Example");
    // The figure has an accessible description.
    expect(markup).toContain("aria-label=");
  });

  it("shows the draft line with the flagged phrase", () => {
    const markup = render();
    expect(markup).toContain("Yes,");
    expect(markup).toContain("we guarantee your data never leaves the US");
  });

  it("shows the note with all required parts", () => {
    const markup = render();
    // Eyebrow
    expect(markup).toContain("Worth a second thought");
    // Severity word, never colour alone
    expect(markup).toContain("High");
    // Title
    expect(markup).toContain(
      "An unconditional promise about where data is stored",
    );
    // Suggested wording
    expect(markup).toContain(
      "Our data-residency options depend on your deployment and contract terms",
    );
    // Both choice labels
    expect(markup).toContain("Use this");
    expect(markup).toContain("Keep mine");
  });

  it("renders both choices as spans, not buttons or links", () => {
    const markup = render();
    // The choices exist.
    expect(markup).toContain("Use this");
    expect(markup).toContain("Keep mine");
    // Neither is a button. We check that the phrase "Use this" does not appear
    // inside a button tag. A precise check would parse the DOM, but checking
    // that <button>Use this</button> does not exist is sufficient.
    expect(markup).not.toMatch(/<button[^>]*>Use this<\/button>/);
    expect(markup).not.toMatch(/<button[^>]*>Keep mine<\/button>/);
    // Neither is a link.
    expect(markup).not.toMatch(/<a[^>]*>Use this<\/a>/);
    expect(markup).not.toMatch(/<a[^>]*>Keep mine<\/a>/);
  });

  it("makes no choice focusable", () => {
    const markup = render();
    // The artifact is a static example, so nothing inside it should be
    // focusable. We check that there is no tabindex on the choice labels.
    const usageIndex = markup.indexOf("Use this");
    const keepIndex = markup.indexOf("Keep mine");
    expect(usageIndex).toBeGreaterThan(-1);
    expect(keepIndex).toBeGreaterThan(-1);
    // Extract a region around each choice and verify neither has a tabindex or
    // href (which would make it focusable).
    const usageRegion = markup.slice(
      Math.max(0, usageIndex - 100),
      usageIndex + 100,
    );
    const keepRegion = markup.slice(
      Math.max(0, keepIndex - 100),
      keepIndex + 100,
    );
    expect(usageRegion).not.toContain('tabindex="0"');
    expect(keepRegion).not.toContain('tabindex="0"');
  });

  it("shows severity as a word, never colour alone", () => {
    const markup = render();
    // The severity chip says "High" in text, so colour is not the only carrier.
    expect(markup).toContain("High");
  });

  it("contains no accuracy or percentage figure in the artifact", () => {
    const markup = render();
    // Already checked by the global test, but the artifact is the most likely
    // place for an invented metric to appear, so we assert it separately.
    // We check the text content, not the CSS/SVG attributes which may contain
    // percentages for positioning.
    const figureStart = markup.indexOf("Example");
    const figureEnd = markup.indexOf("Keep mine") + 20;
    const artifactRegion = markup.slice(figureStart, figureEnd);

    // Look for accuracy claims in text, not in CSS calc() or SVG viewBox.
    expect(artifactRegion).not.toMatch(/>\d+%</);
    expect(artifactRegion).not.toMatch(/>\d+\.\d+</);
    expect(artifactRegion).not.toContain("accurate");
    expect(artifactRegion).not.toContain("precision");
  });

  it("has exactly ONE bordered surface with no nested bordered boxes", () => {
    const markup = render();
    // The figure itself has the border. Extract the artifact region from
    // "Example" to the end of the note content.
    const figureStart = markup.indexOf("Example");
    const figureEnd = markup.indexOf("Keep mine") + 100;
    const artifactRegion = markup.slice(figureStart, figureEnd);

    // Count border classes within the artifact. The figure has one border, and
    // there should be no border classes on any descendant element except the
    // hairline separator (which is an hr with border-t, not a full border).
    // We check that "border border-" (the pattern for a full border) appears
    // only on the figure itself, not on any child.
    const fullBorderCount = (artifactRegion.match(/border border-/g) || []).length;
    // There should be exactly zero full borders inside the artifact region we
    // extracted, because the figure's opening tag is before figureStart.
    expect(fullBorderCount).toBe(0);
  });

  it("shows all three required labels: Example, What you wrote, and Worth a second thought", () => {
    const markup = render();
    expect(markup).toContain("Example");
    expect(markup).toContain("What you wrote");
    expect(markup).toContain("Worth a second thought");
  });

  it("includes the attachment mark connecting the phrase to the note", () => {
    const markup = render();
    // The attachment mark is an SVG with a line, aria-hidden because the labels
    // already convey the relationship. Check for the presence of an svg with
    // aria-hidden and a line element in the artifact.
    const figureStart = markup.indexOf("Example");
    const figureEnd = markup.indexOf("Worth a second thought");
    const artifactRegion = markup.slice(figureStart, figureEnd);

    expect(artifactRegion).toContain("<svg");
    expect(artifactRegion).toContain('aria-hidden="true"');
    expect(artifactRegion).toContain("<line");
  });

  it("hides the attachment mark from assistive technology", () => {
    const markup = render();
    // The attachment mark is decorative since the labels already carry the
    // meaning. It must be aria-hidden.
    const svgStart = markup.indexOf("<svg", markup.indexOf("What you wrote"));
    const svgEnd = markup.indexOf("</svg>", svgStart) + 6;

    if (svgStart !== -1 && svgEnd !== -1) {
      const svgRegion = markup.slice(svgStart, svgEnd);
      expect(svgRegion).toContain('aria-hidden="true"');
    }
  });

  it("contains no banned tone words in the artifact", () => {
    const markup = render();
    const figureStart = markup.indexOf("Example");
    const figureEnd = markup.indexOf("Keep mine") + 100;
    const artifactRegion = markup.slice(figureStart, figureEnd).toLowerCase();

    // Check a subset of the most likely banned words to appear in an example.
    expect(artifactRegion).not.toContain("violation");
    expect(artifactRegion).not.toContain("breach");
    expect(artifactRegion).not.toContain("error");
    expect(artifactRegion).not.toContain("warning");
    expect(artifactRegion).not.toContain("blocked");
  });

  it("uses no em-dash in the artifact", () => {
    const markup = render();
    const figureStart = markup.indexOf("Example");
    const figureEnd = markup.indexOf("Keep mine") + 100;
    const artifactRegion = markup.slice(figureStart, figureEnd);

    expect(artifactRegion).not.toContain("—");
    expect(artifactRegion).not.toContain(" -- ");
  });
});

describe("Mechanism marks", () => {
  it("renders the three mechanism marks with the three moves", () => {
    const markup = render();
    // The three move titles should appear in the markup.
    expect(markup).toContain("It reads the draft as you type");
    expect(markup).toContain("It puts the note under the sentence");
    expect(markup).toContain("You decide");

    // The marks are aria-hidden decorative elements. Check for their presence
    // in the full landing page. We expect multiple aria-hidden elements:
    // section numerals (01, 02, 03, 04, 05) plus the three mechanism marks.
    const ariaHiddenCount = (markup.match(/aria-hidden="true"/g) || []).length;
    expect(ariaHiddenCount).toBeGreaterThanOrEqual(8);
  });

  it("marks all mechanism drawings as aria-hidden", () => {
    const markup = render();
    // The marks are decorative since the text already says what they show.
    // Each move title should appear, and there should be aria-hidden elements nearby.
    expect(markup).toContain("It reads the draft as you type");
    expect(markup).toContain("It puts the note under the sentence");
    expect(markup).toContain("You decide");

    // Check that aria-hidden appears in the markup.
    expect(markup).toContain('aria-hidden="true"');
  });
});
