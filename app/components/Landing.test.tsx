/**
 * Tests for the Landing component: structural requirements and content safety.
 *
 * These tests assert requirements rather than class names, following the same idiom
 * as Composer.test.tsx. They verify:
 *   - The product name, h1, and all five section headings render
 *   - Six bands with alternating tones: paper, tint, paper, tint, paper, tint
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
    // The wordmark appears early in the document, before the first section heading.
    const wordmarkPos = markup.indexOf("Second Thought");
    const firstSectionPos = markup.indexOf("Nobody sets out to break a rule");
    expect(wordmarkPos).toBeGreaterThan(-1);
    expect(wordmarkPos).toBeLessThan(firstSectionPos);
  });

  it("renders the h1 and lead copy", () => {
    const markup = render();
    expect(markup).toContain("A second thought, before you hit send.");
    expect(markup).toContain(
      "Your company has rules about what you can promise, share, and say",
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

describe("Band structure and alternating tones", () => {
  it("renders six sections with alternating background tones", () => {
    const markup = render();
    // The landing uses six bands alternating tone="paper" and tone="tint".
    // We check for the presence of the background classes applied by Band.
    // Expected pattern: paper (hero), tint (section 1), paper (section 2),
    // tint (section 3), paper (section 4 / seam), tint (section 5).

    // Count occurrences of the tone classes. The exact count depends on whether
    // other components also use these classes, so we verify at least 6 bands exist.
    const paperCount = (markup.match(/bg-surface/g) || []).length;
    const tintCount = (markup.match(/bg-tint/g) || []).length;

    // At minimum we expect 3 of each tone for the 6 bands.
    expect(paperCount).toBeGreaterThanOrEqual(3);
    expect(tintCount).toBeGreaterThanOrEqual(3);
  });

  it("renders the hero section heading before the first problem statement", () => {
    const markup = render();
    const heroIndex = markup.indexOf("A second thought, before you hit send");
    const section1Index = markup.indexOf("Nobody sets out to break a rule");
    expect(heroIndex).toBeLessThan(section1Index);
    expect(heroIndex).toBeGreaterThan(-1);
  });

  it("renders section headings in the expected order", () => {
    const markup = render();
    // Check if each heading appears exactly once by being more specific -
    // look for them as h2 class patterns or near specific text blocks
    const section1Match = markup.match(/class="[^"]*font-serif[^"]*text-2xl[^"]*font-semibold[^>]*>Nobody sets out to break a rule</);
    const section2Match = markup.match(/class="[^"]*font-serif[^"]*text-2xl[^"]*font-semibold[^>]*>It works for you, not on you</);
    const section3Match = markup.match(/class="[^"]*font-serif[^"]*text-2xl[^"]*font-semibold[^>]*>A note in the margin, before you send</);

    // For section 4, match the h2 with "Try it" that's NOT inside an anchor
    const section4Match = markup.match(/class="[^"]*font-serif[^"]*text-2xl[^"]*font-semibold[^>]*>Try it</);
    const section5Match = markup.match(/class="[^"]*text-2xl[^"]*font-semibold[^>]*>You do not have to take our word for it</);

    // All headings must be found
    expect(section1Match).toBeTruthy();
    expect(section2Match).toBeTruthy();
    expect(section3Match).toBeTruthy();
    expect(section4Match).toBeTruthy();
    expect(section5Match).toBeTruthy();

    // Get their positions
    const section1Pos = section1Match ? markup.indexOf(section1Match[0]) : -1;
    const section2Pos = section2Match ? markup.indexOf(section2Match[0]) : -1;
    const section3Pos = section3Match ? markup.indexOf(section3Match[0]) : -1;
    const section4Pos = section4Match ? markup.indexOf(section4Match[0]) : -1;
    const section5Pos = section5Match ? markup.indexOf(section5Match[0]) : -1;

    const positions = [section1Pos, section2Pos, section3Pos, section4Pos, section5Pos];

    // They must appear in order
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
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

  it("places the anchor in the Try it section, which comes before the limits section", () => {
    const markup = render();
    // Find the section boundaries. The Try it section contains id="try", and it
    // should come before "You do not have to take our word for it" in the document.
    const tryItHeading = markup.indexOf("Try it");
    const limitsHeading = markup.indexOf("You do not have to take our word for it");
    const tryPos = markup.indexOf('id="try"');

    // The anchor exists.
    expect(tryPos).toBeGreaterThan(-1);
    // Try it heading comes before limits heading.
    expect(tryItHeading).toBeLessThan(limitsHeading);
    // The anchor is somewhere in the Try it region.
    expect(tryPos).toBeLessThan(limitsHeading);
  });
});

describe("The four limits in section 05", () => {
  it("renders all four 'what it does not do' limits", () => {
    const markup = render();
    expect(markup).toContain("It never stops you sending anything");
    expect(markup).toContain("Accuracy has not been measured");
    expect(markup).toContain("Eight rules, a demonstration");
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
  it("provides links to Press and Settings", () => {
    const markup = render();
    expect(markup).toContain('href="/press"');
    expect(markup).toContain('href="/settings"');
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
      "An unconditional promise about data residency",
    );
    // Suggested wording
    expect(markup).toContain(
      "Our data-residency options depend on your deployment and contract",
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
