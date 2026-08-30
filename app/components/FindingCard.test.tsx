/**
 * The card's product decisions, tested as decisions rather than as pixels.
 *
 * `@testing-library/react` is not installed and this task may not install it, so
 * there is no click simulation here. Two things stand in for it, and between them
 * they cover everything except the DOM event itself: the pure helpers that decide
 * copy, ordering, and which remedy a finding gets, and `renderToStaticMarkup`,
 * which needs no DOM and lets the structural non-negotiables be asserted on real
 * output. What is NOT covered: that clicking the buttons calls `onAccept` and
 * `onKeep`. That is one line of wiring, visible in the source.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Finding } from "@/app/lib/types";
import {
  FindingCard,
  provenanceLine,
  provenanceSegments,
  remediationOptions,
  ruleOption,
  type RemediationOption,
} from "./FindingCard";
import { severityLabel } from "./SeverityChip";

const SEMANTIC: Finding = {
  ruleId: "residency-promise",
  ruleSource: "company",
  title: "An unconditional promise about where data is stored",
  severity: "high",
  category: "claim",
  why:
    "Where data lives depends on how the deployment is configured and what the contract says. " +
    "An unconditional promise can commit your company to more than it has agreed to.",
  replacement:
    "Our data-residency options depend on your deployment and contract terms. I can put you in " +
    "touch with our security team for the specifics.",
  matchedText: "Yes, we guarantee your data never leaves the US.",
  start: 0,
  end: 47,
  source: "semantic",
  score: 0.7412,
};

/** A terms finding: `strong-language` has no replacement by design (§13 R8). */
const TERMS: Finding = {
  ruleId: "strong-language",
  ruleSource: "company",
  title: "Strong language",
  severity: "low",
  category: "language",
  why:
    "Fine in some rooms and not in others, and this thread may be read by people who are not in " +
    "the room.",
  matchedText: "damn",
  start: 8,
  end: 12,
  source: "pattern",
};

const noop = () => {};
const text = (markup: string) => markup.replace(/<[^>]*>/g, "");

describe("severityLabel", () => {
  it("gives every severity a word, so colour is never the only carrier", () => {
    expect(severityLabel("high")).toBe("High");
    expect(severityLabel("medium")).toBe("Medium");
    expect(severityLabel("low")).toBe("Low");
  });
});

describe("provenanceLine", () => {
  it("names the rule and the score for a semantic finding, to two places", () => {
    expect(provenanceLine(SEMANTIC)).toBe(
      "Matched on your device · residency-promise · 0.74",
    );
  });

  it("says `pattern` and no rule id for a deterministic finding", () => {
    expect(provenanceLine(TERMS)).toBe("Matched on your device · pattern");
  });

  it("drops the score rather than printing `undefined` when there is none", () => {
    const scoreless = { ...SEMANTIC, score: undefined };
    expect(provenanceLine(scoreless)).toBe(
      "Matched on your device · residency-promise",
    );
  });

  it("keeps the rule id and score in one segment, for the mono face", () => {
    expect(provenanceSegments(SEMANTIC).detail).toBe("residency-promise · 0.74");
  });
});

describe("ruleOption", () => {
  it("offers the approved wording when the rule has one", () => {
    const option = ruleOption(SEMANTIC);
    expect(option.actionLabel).toBe("Use this");
    expect(option.heading).toBe("Suggested wording");
    expect(option.text).toBe(SEMANTIC.replacement);
    expect(option.isDefault).toBe(true);
  });

  it("offers `Remove it` and no quotation when there is no replacement", () => {
    const option = ruleOption(TERMS);
    expect(option.actionLabel).toBe("Remove it");
    expect(option.text).toBeUndefined();
    expect(option.heading).toBeUndefined();
  });

  it("labels a personal rule's wording as the visitor's own", () => {
    expect(ruleOption({ ...SEMANTIC, ruleSource: "personal" }).provenance).toBe(
      "Your own rules",
    );
    expect(ruleOption(SEMANTIC).provenance).toBe("From your company");
  });
});

describe("remediationOptions", () => {
  const rewrite: RemediationOption = {
    id: "local",
    actionLabel: "Use this",
    heading: "In your words",
    text: "Our residency options depend on the deployment.",
    provenance: "Written on your device by a small model · 1.9s",
  };

  it("is a list of one before E5 exists, so E5 adds rather than rewrites", () => {
    expect(remediationOptions(SEMANTIC).map((o) => o.id)).toEqual([
      "residency-promise:suggested",
    ]);
  });

  it("lists the rule's own wording first and a generated rewrite second", () => {
    expect(remediationOptions(SEMANTIC, [rewrite]).map((o) => o.id)).toEqual([
      "residency-promise:suggested",
      "local",
    ]);
  });

  it("orders by the `isDefault` flag on the data, not by array position", () => {
    const flagged: RemediationOption = { ...rewrite, id: "flagged", isDefault: true };
    const plain: RemediationOption = { ...rewrite, id: "plain" };
    // `plain` is given first and still lands last, because the flag decides.
    const order = remediationOptions(TERMS, [plain, flagged]).map((o) => o.id);
    expect(order).toEqual(["strong-language:remove", "flagged", "plain"]);
  });
});

const render = (finding: Finding, extra?: RemediationOption[]) =>
  renderToStaticMarkup(
    <FindingCard
      finding={finding}
      onAccept={noop}
      onKeep={noop}
      extraOptions={extra}
    />,
  );

const classesOf = (markup: string, tag: string) =>
  [...markup.matchAll(new RegExp(`<${tag}[^>]*class="([^"]*)"`, "g"))].map(
    (m) => m[1],
  );

describe("FindingCard anatomy", () => {
  it("renders §7's parts in order, with every string from the §14 deck", () => {
    const body = text(render(SEMANTIC));
    const order = [
      "Worth a second thought",
      "High",
      SEMANTIC.title,
      SEMANTIC.why,
      SEMANTIC.matchedText,
      "Suggested wording",
      SEMANTIC.replacement!,
      "Use this",
      "Keep mine",
      "Matched on your device · residency-promise · 0.74",
    ];
    let cursor = -1;
    for (const part of order) {
      const at = body.indexOf(part, cursor + 1);
      expect(at, `missing or out of order: ${part}`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it("uses no word from §14's banned list", () => {
    const body = text(render(SEMANTIC)) + text(render(TERMS));
    for (const word of [
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
    ]) {
      expect(body.toLowerCase()).not.toContain(word);
    }
  });
});

describe("FindingCard, the decisions that must not drift", () => {
  it("gives both actions the identical class, so neither can become primary", () => {
    const buttons = classesOf(render(SEMANTIC), "button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toBe(buttons[1]);
  });

  /**
   * These two tests used to assert `border-l-2` and `border-l-severity-*-border`.
   * That treatment is BANNED now: a coloured side stripe over 1px on a card or
   * callout is a template cliché, and `design-context/DESIGN.md` supersedes the
   * older spec that mandated it.
   *
   * The lesson matters more than the edit. They pinned an implementation detail,
   * one class name, rather than the requirement. So changing the design
   * *correctly* broke them, while a bad design that happened to keep the class
   * would have sailed through. Assert the requirement: severity is legible, never
   * carried by colour alone, and never a fill.
   *
   * Severity now lives as a tinted FULL border on the enclosing draft surface,
   * which is `PendingDraft`'s job. This guidance deliberately carries no border
   * of its own, because a bordered card inside a bordered draft is exactly the
   * nested-card ban.
   */
  it("never carries a severity fill, and owns no border of its own", () => {
    const markup = render(SEMANTIC);
    const root = classesOf(markup, "section")[0];
    // A fill here is the scold read, and nothing has been sent yet.
    expect(root).not.toMatch(/bg-severity-/);
    // The banned stripe, in any spelling.
    expect(root).not.toMatch(/border-l-\d/);
    // The draft it hangs off owns the boundary; a border here would nest.
    expect(root).not.toMatch(/(^|\s)border(\s|$)/);
    expect(markup).not.toContain("-wash");
    expect(markup.match(/severity-\w+-quiet/g)).toHaveLength(1);
  });

  // High is the path a reviewer looks at, so medium and low are where a fill or a
  // stripe could reappear unnoticed.
  it("says the severity word at every level, and never leans on colour alone", () => {
    for (const severity of ["high", "medium", "low"] as const) {
      const markup = render({ ...SEMANTIC, severity });
      const root = classesOf(markup, "section")[0];
      expect(root, severity).not.toMatch(/bg-severity-/);
      expect(root, severity).not.toMatch(/border-l-\d/);
      expect(markup.match(/severity-\w+-quiet/g), severity).toHaveLength(1);
      // The carrier that survives forced-colours mode and colour blindness.
      expect(text(markup), severity).toContain(severityLabel(severity));
    }
  });

  it("enters by the one shared fade-and-rise, which reduced motion flattens", () => {
    expect(classesOf(render(SEMANTIC), "section")[0]).toContain("animate-rise-in");
  });

  it("uses no Tailwind palette colour and no `dark:` variant", () => {
    const markup = render(SEMANTIC) + render(TERMS);
    expect(markup).not.toMatch(
      /-(?:red|rose|amber|orange|yellow|slate|gray|zinc|neutral|stone|blue)-\d{2,3}\b/,
    );
    expect(markup).not.toContain("dark:");
  });

  it("has a heading and a label, and neither announces nor steals focus", () => {
    const markup = render(SEMANTIC);
    expect(markup).toMatch(/<h3 id="[^"]+"/);
    expect(markup).toMatch(/aria-labelledby="[^"]+"/);
    // The list that renders these owns the live region (§10); a per-card one
    // would announce once per card and fight itself.
    expect(markup).not.toContain("aria-live");
    expect(markup.toLowerCase()).not.toContain("autofocus");
    expect(markup).not.toContain("tabindex");
  });
});

describe("FindingCard, a finding with no replacement", () => {
  it("offers `Remove it` instead of a suggestion nobody wrote", () => {
    const markup = render(TERMS);
    const body = text(markup);
    expect(body).toContain("Remove it");
    expect(body).not.toContain("Use this");
    expect(body).not.toContain("Suggested wording");
    expect(body).toContain("Matched on your device · pattern");
    // Still two equal actions: remove it, or keep your own wording.
    expect(classesOf(markup, "button")).toHaveLength(2);
    expect(body).toContain("Keep mine");
  });

  it("quotes the flagged word so it need not be hunted in the composer", () => {
    expect(text(render(TERMS))).toContain("damn");
  });
});

describe("FindingCard, a rewrite still streaming", () => {
  const pending: RemediationOption = {
    id: "local",
    actionLabel: "Use this",
    heading: "In your words",
    pending: true,
  };

  it("offers `Keep mine` exactly once when a second remedy has arrived", () => {
    const ready: RemediationOption = {
      id: "local",
      actionLabel: "Use this",
      heading: "In your words",
      text: "Our residency options depend on the deployment.",
    };
    const body = text(render(SEMANTIC, [ready]));
    // Two `Use this` and one `Keep mine`: keeping your own wording is a property
    // of the card, not of a remedy, so it must not multiply with the list.
    expect(body.match(/Use this/g)).toHaveLength(2);
    expect(body.match(/Keep mine/g)).toHaveLength(1);
  });

  it("says it is preparing and offers nothing to click yet", () => {
    const markup = render(SEMANTIC, [pending]);
    const body = text(markup);
    expect(body).toContain("Preparing a version in your words…");
    expect(body).toContain("In your words");
    // Only the first remedy's two buttons: no disabled control for a pending one.
    expect(classesOf(markup, "button")).toHaveLength(2);
  });
});
