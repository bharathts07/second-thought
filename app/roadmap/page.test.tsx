/**
 * Tests for the roadmap page.
 *
 * The roadmap is the ONE page where technical vocabulary is allowed, so
 * unlike other pages this test does NOT ban technical terms. It DOES still
 * enforce the tone rules: no fault-implying language, no overclaiming, no
 * em-dash.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import RoadmapPage from "./page";
import {
  MODEL_ID,
  MODEL_REVISION,
  MODEL_DTYPE,
  EMBEDDING_DIMS,
} from "@/app/lib/model";

const markup = () => renderToStaticMarkup(<RoadmapPage />);

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
 * The same off-limits list from other tone tests. Technical vocabulary is
 * allowed on THIS page, but fault-implying language is still banned.
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

describe("roadmap: structure", () => {
  it("has the site nav with roadmap marked current", () => {
    const html = markup();
    expect(html).toContain("Second Thought");
    expect(html).toContain('aria-current="page"');
  });

  it("has three main sections with headings", () => {
    const html = markup();
    expect(html).toContain("What downloads");
    expect(html).toContain("Model details");
    expect(html).toContain("Current status");
  });

  it("uses alternating Band tones", () => {
    const html = markup();
    // Should have both bg-surface (paper) and bg-tint
    expect(html).toContain("bg-surface");
    expect(html).toContain("bg-tint");
  });

  it("includes the disclaimer in the footer", () => {
    const body = text(markup());
    expect(body).toContain("drafting aid");
    expect(body).toContain("does not ensure compliance");
  });
});

describe("roadmap: model details are live, not retyped", () => {
  it("shows the actual MODEL_ID from model.ts", () => {
    const body = text(markup());
    expect(body).toContain(MODEL_ID);
  });

  it("shows the actual MODEL_REVISION", () => {
    const body = text(markup());
    expect(body).toContain(MODEL_REVISION);
  });

  it("shows the actual MODEL_DTYPE", () => {
    const body = text(markup());
    expect(body).toContain(MODEL_DTYPE);
  });

  it("shows the actual EMBEDDING_DIMS", () => {
    const body = text(markup());
    expect(body).toContain(String(EMBEDDING_DIMS));
  });

  it("carries the attribution line for product names", () => {
    const body = text(markup());
    expect(body).toContain("trademarks of their respective owners");
  });
});

describe("roadmap: status section is honest", () => {
  it("lists shipped features", () => {
    const body = text(markup());
    expect(body).toContain("In-browser checker");
    expect(body).toContain("Shipped");
  });

  it("labels placeholder features as Placeholder, not Shipped", () => {
    const body = text(markup());
    expect(body).toContain("Similarity bars");
    expect(body).toContain("Placeholder");
    expect(body).toContain("untuned value");
  });

  it("labels unbuilt features as Not built", () => {
    const body = text(markup());
    expect(body).toContain("Browser extension");
    expect(body).toContain("Not built");
  });

  it("never invents a version number or percentage", () => {
    const body = text(markup());
    // No "v1.0" or "95% accurate" or similar
    expect(body).not.toMatch(/v\d+\.\d+/);
    expect(body).not.toMatch(/\d+%/);
  });
});

describe("roadmap: tone", () => {
  it("never reaches for a word that implies fault", () => {
    const body = text(markup()).toLowerCase();

    for (const word of OFF_LIMITS) {
      expect(body).not.toContain(word);
    }
  });

  it("claims being a drafting aid, not preventing or guaranteeing", () => {
    const body = text(markup()).toLowerCase();
    expect(body).toContain("drafting aid");
    // The disclaimer says "does not ensure compliance" which is fine
    expect(body).not.toContain("prevents");
    expect(body).not.toContain("guarantees that");
  });

  it("uses no em-dash and no double hyphen anywhere a reader can see", () => {
    const body = text(markup());
    expect(body).not.toContain("—");
    expect(body).not.toContain("--");
  });
});

describe("roadmap: what downloads section", () => {
  it("lists all three tiers with their sizes", () => {
    const body = text(markup());
    expect(body).toContain("~150KB");
    expect(body).toContain("~22MB");
    expect(body).toContain("~280MB");
  });

  it("explains that pattern checks run immediately", () => {
    const body = text(markup());
    expect(body).toContain("Pattern checks are already running");
  });

  it("states that wording checks need a one-time download", () => {
    const body = text(markup());
    expect(body).toContain("one-time 22MB download");
  });
});
