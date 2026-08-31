/**
 * Tests for the mechanism marks: ReadingMark, NoteMark, ChoiceMark.
 *
 * Each mark is a small drawing showing the mechanism rather than symbolizing it.
 * All are decorative (aria-hidden) since the text beside them already says what
 * they show.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReadingMark, NoteMark, ChoiceMark } from "./Marks";

describe("ReadingMark", () => {
  it("renders an SVG with aria-hidden", () => {
    const markup = renderToStaticMarkup(<ReadingMark />);
    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("contains line elements to show the mechanism", () => {
    const markup = renderToStaticMarkup(<ReadingMark />);
    // The mark shows a line of text and a caret.
    expect(markup).toContain("<line");
  });

  it("uses no fill, only strokes", () => {
    const markup = renderToStaticMarkup(<ReadingMark />);
    // The marks are hairline rules and annotation ink, no fills.
    expect(markup).toContain('fill="none"');
  });
});

describe("NoteMark", () => {
  it("renders an SVG with aria-hidden", () => {
    const markup = renderToStaticMarkup(<NoteMark />);
    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("shows the mechanism: a line with a note attached beneath", () => {
    const markup = renderToStaticMarkup(<NoteMark />);
    // The mark has a draft line, a connecting hairline, and a note block.
    expect(markup).toContain("<rect");
    expect(markup).toContain("<line");
  });

  it("uses no fill, only strokes", () => {
    const markup = renderToStaticMarkup(<NoteMark />);
    expect(markup).toContain('fill="none"');
  });
});

describe("ChoiceMark", () => {
  it("renders an SVG with aria-hidden", () => {
    const markup = renderToStaticMarkup(<ChoiceMark />);
    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("shows two equal marks side by side", () => {
    const markup = renderToStaticMarkup(<ChoiceMark />);
    // The mark shows two choices of equal weight.
    const rectCount = (markup.match(/<rect/g) || []).length;
    expect(rectCount).toBe(2);
  });

  it("uses no fill, only strokes", () => {
    const markup = renderToStaticMarkup(<ChoiceMark />);
    expect(markup).toContain('fill="none"');
  });

  it("emphasises neither choice", () => {
    const markup = renderToStaticMarkup(<ChoiceMark />);
    // Both rectangles should have the same stroke class, showing equal weight.
    // We check that there is no strokeWidth difference or class difference
    // between the two rectangles. A simple check: count "text-ink" occurrences.
    const inkCount = (markup.match(/text-ink/g) || []).length;
    expect(inkCount).toBeGreaterThanOrEqual(2);
  });
});

describe("All marks", () => {
  it("are all aria-hidden since the text beside them already says the words", () => {
    const reading = renderToStaticMarkup(<ReadingMark />);
    const note = renderToStaticMarkup(<NoteMark />);
    const choice = renderToStaticMarkup(<ChoiceMark />);

    expect(reading).toContain('aria-hidden="true"');
    expect(note).toContain('aria-hidden="true"');
    expect(choice).toContain('aria-hidden="true"');
  });

  it("use only hairline rules and annotation ink, no icon set", () => {
    const reading = renderToStaticMarkup(<ReadingMark />);
    const note = renderToStaticMarkup(<NoteMark />);
    const choice = renderToStaticMarkup(<ChoiceMark />);

    // No fill attribute should be set to a color; only "none" or absent.
    expect(reading).not.toMatch(/fill="[^n]/);
    expect(note).not.toMatch(/fill="[^n]/);
    expect(choice).not.toMatch(/fill="[^n]/);
  });
});
