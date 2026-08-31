import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Band } from "./Band";

describe("Band", () => {
  it("renders with paper tone by default as a section", () => {
    const html = renderToStaticMarkup(
      <Band tone="paper">
        <h2>Content</h2>
      </Band>
    );
    expect(html).toContain("<section");
    expect(html).toContain("bg-surface");
    expect(html).toContain("Content");
  });

  it("renders with tint tone", () => {
    const html = renderToStaticMarkup(
      <Band tone="tint">
        <p>Tinted content</p>
      </Band>
    );
    expect(html).toContain("bg-tint");
    expect(html).toContain("Tinted content");
  });

  it("renders as a different element when as prop is provided", () => {
    const html = renderToStaticMarkup(
      <Band tone="paper" as="div">
        <p>Div content</p>
      </Band>
    );
    expect(html).toContain("<div");
    expect(html).not.toContain("<section");
  });

  it("centers content at app measure", () => {
    const html = renderToStaticMarkup(
      <Band tone="paper">
        <p>Centered</p>
      </Band>
    );
    // The inner wrapper has max-w-app and mx-auto for centering
    expect(html).toContain("max-w-app");
    expect(html).toContain("mx-auto");
  });

  it("applies generous vertical padding", () => {
    const html = renderToStaticMarkup(
      <Band tone="paper">
        <p>Padded</p>
      </Band>
    );
    expect(html).toContain("py-rhythm-section");
  });

  it("allows className override", () => {
    const html = renderToStaticMarkup(
      <Band tone="paper" className="py-12 custom-class">
        <p>Custom</p>
      </Band>
    );
    expect(html).toContain("custom-class");
    // Both the default and override are present
    expect(html).toContain("py-rhythm-section");
  });

  it("passes through additional props", () => {
    const html = renderToStaticMarkup(
      <Band tone="tint" data-testid="test-band" aria-label="Test band">
        <p>Props</p>
      </Band>
    );
    expect(html).toContain('data-testid="test-band"');
    expect(html).toContain('aria-label="Test band"');
  });

  it("renders both tones distinctly", () => {
    const paperHtml = renderToStaticMarkup(
      <Band tone="paper">
        <p>Paper</p>
      </Band>
    );
    const tintHtml = renderToStaticMarkup(
      <Band tone="tint">
        <p>Tint</p>
      </Band>
    );

    expect(paperHtml).toContain("bg-surface");
    expect(paperHtml).not.toContain("bg-tint");
    expect(tintHtml).toContain("bg-tint");
    expect(tintHtml).not.toContain("bg-surface");
  });
});
