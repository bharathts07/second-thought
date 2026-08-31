/**
 * Tests for the privacy page.
 *
 * This page carries the strongest privacy claims the product makes, so every
 * string on it is checked against the product's actual behavior. A claim that
 * was true when written but is falsified by a later code change is worse than
 * no claim at all (content-safety.md §7, F14).
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "./page";

const markup = () => renderToStaticMarkup(<PrivacyPage />);

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
 * Technical vocabulary is banned on the privacy page (except where it names
 * the three browser storage surfaces, which is unavoidable). A worried reader
 * should not have to understand "inference" or "semantic" to learn what the
 * product does with their data.
 */
const TECHNICAL_BANNED = [
  "webgpu",
  "wasm",
  "webassembly",
  "embedding",
  "semantic",
  "threshold",
  "confidence score",
  "inference",
  "vector",
  "network requests", // say "nothing is sent" instead
  "pattern checks", // say "the check" instead
];

/**
 * Fault-implying language is also banned, per content-safety.md §1.
 */
const FAULT_BANNED = [
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

describe("privacy: structure", () => {
  it("has the site nav with privacy marked current", () => {
    const html = markup();
    expect(html).toContain("Second Thought");
    expect(html).toContain('aria-current="page"');
    // Check that the right item is marked current
    const navMatch = html.match(
      /<a[^>]*href="\/privacy"[^>]*aria-current="page"[^>]*>Privacy<\/a>/,
    );
    expect(navMatch).toBeTruthy();
  });

  it("uses alternating Band tones", () => {
    const html = markup();
    // Should have both bg-surface (paper) and bg-tint
    expect(html).toContain("bg-surface");
    expect(html).toContain("bg-tint");
  });

  it("has the expected major sections", () => {
    const body = text(markup());
    expect(body).toContain("Nothing you type leaves this machine");
    expect(body).toContain("What is kept, and where");
    expect(body).toContain("Why the product is built this way");
    expect(body).toContain("What this product is not");
    expect(body).toContain("How to clear everything");
  });
});

describe("privacy: the strongest claim comes first", () => {
  it("leads with 'nothing you type leaves this machine'", () => {
    const body = text(markup());
    expect(body).toContain("Nothing you type leaves this machine");
  });

  it("states that there is no server", () => {
    const body = text(markup());
    expect(body).toContain("no server");
  });

  it("states that drafts are never stored and never sent", () => {
    const body = text(markup());
    expect(body).toContain("never stored");
    expect(body).toContain("never sent");
  });

  it("states that everything is gone when you close the tab", () => {
    const body = text(markup());
    expect(body).toContain("close the tab");
    expect(body).toContain("gone");
  });

  it("states there is nothing to export or hand over", () => {
    const body = text(markup());
    expect(body).toContain("nothing to export");
    expect(body).toContain("nothing to hand over");
  });
});

describe("privacy: the three storage surfaces", () => {
  it("lists all three storage surfaces by name", () => {
    const body = text(markup());
    // The three surfaces from the browser's storage model
    expect(body).toContain("Local storage");
    expect(body).toContain("Browser database");
    expect(body).toContain("Cache storage");
  });

  it("states what preferences are kept in local storage", () => {
    const body = text(markup());
    expect(body).toContain("Your preferences");
    expect(body).toContain("Local storage");
  });

  it("states that rules you write will be in IndexedDB when authoring ships", () => {
    const body = text(markup());
    expect(body).toContain("Rules you write");
    expect(body).toContain("Browser database");
    expect(body).toContain("rule authoring");
  });

  it("states that model files are cached", () => {
    const body = text(markup());
    expect(body).toContain("model files");
    expect(body).toContain("Cache storage");
    expect(body).toContain("22MB");
  });

  it("is honest about what is not stored in this build", () => {
    const body = text(markup());
    expect(body).toContain("this version");
    expect(body).toContain("not wired up yet");
  });

  it("states that drafts and findings are in memory only", () => {
    const body = text(markup());
    expect(body).toContain("memory only");
  });
});

describe("privacy: design reasoning", () => {
  it("states that there is no reporting or telemetry", () => {
    const body = text(markup());
    expect(body).toContain("no console");
    expect(body).toContain("no dashboard");
    expect(body).toContain("no log");
  });

  it("states that nobody is shown what you wrote", () => {
    const body = text(markup());
    expect(body).toContain("you are not shown what they wrote");
  });

  it("states that labor topics are excluded by construction", () => {
    const body = text(markup());
    expect(body).toContain("pay, hours, working conditions, and organizing");
    expect(body).toContain("by design");
  });

  it("carries the 'works for you, not on you' claim", () => {
    const body = text(markup());
    expect(body).toContain("works for you, not on you");
  });
});

describe("privacy: what this is not", () => {
  it("disclaims legal and compliance advice", () => {
    const body = text(markup());
    expect(body).toContain("drafting aid");
    expect(body).toContain("does not provide legal or compliance advice");
    expect(body).toContain("does not ensure compliance");
  });

  it("distinguishes this from monitoring tools", () => {
    const body = text(markup());
    expect(body).toContain("not monitoring");
    expect(body).toContain("before you send");
  });

  it("states that the rule set is a demonstration, not a compliance program", () => {
    const body = text(markup());
    expect(body).toContain("demonstration");
    expect(body).toContain("not a compliance program");
  });
});

describe("privacy: how to clear", () => {
  it("explains how to clear all storage at once", () => {
    const body = text(markup());
    expect(body).toContain("browser's site data");
    expect(body).toContain("removes all three");
  });

  it("is honest about the unbuilt clear-all control", () => {
    const body = text(markup());
    expect(body).toContain("not wired up yet");
    expect(body).toContain("honest absence");
  });
});

describe("privacy: tone and plain language", () => {
  it("never uses fault-implying language", () => {
    const body = text(markup()).toLowerCase();
    for (const word of FAULT_BANNED) {
      expect(body).not.toContain(word);
    }
  });

  it("uses plain language, not technical vocabulary", () => {
    const body = text(markup()).toLowerCase();
    for (const term of TECHNICAL_BANNED) {
      expect(body).not.toContain(term);
    }
  });

  it("uses no em-dash and no double hyphen anywhere a reader can see", () => {
    const body = text(markup());
    expect(body).not.toContain("—");
    expect(body).not.toContain("--");
  });

  it("never overclaims with 'prevents', 'ensures', 'guarantees', or 'protects'", () => {
    const body = text(markup()).toLowerCase();
    // The disclaimer says "does not ensure compliance" which is fine
    // But we should never claim that we DO ensure, prevent, guarantee, or protect
    expect(body).not.toContain("prevents");
    expect(body).not.toContain("guarantees");
    expect(body).not.toContain("protects you");
    expect(body).not.toContain("ensures compliance");
  });
});

describe("privacy: no future promises, only current state", () => {
  it("describes what is true now, not what will be true", () => {
    const body = text(markup());
    // When talking about future features, it should say "when X ships" or
    // "not wired up yet", not "will provide" or "will protect"
    expect(body).toContain("When rule authoring ships");
    expect(body).toContain("not wired up yet");
  });

  it("never promises a future capability as if it were present", () => {
    const body = text(markup());
    // Should not say things like "will keep your data safe" or "will never..."
    // Only "does not" (current state) or "when X ships" (conditional)
    const hasWillClaim = /will (never|always|keep|protect|ensure)/.test(body);
    expect(hasWillClaim).toBe(false);
  });
});
