/**
 * The composer's and the guidance panel's decisions, tested as decisions.
 *
 * `@testing-library/react` is not installed and this task may not install it, so
 * there is no click simulation here. Two things stand in for it: the pure helpers
 * that decide copy, ordering, locating, and scope, and `renderToStaticMarkup`,
 * which needs no DOM and lets the structural non-negotiables be asserted on real
 * output. What is NOT covered: that a click reaches the handler, and the ghost
 * hint's pointer behaviour, both of which are visible in the source.
 *
 * Several of these tests exist because a reviewed defect was found here first:
 * F9 (which occurrence an accept acts on), F25 (no `example.com` in the internal
 * thread), F26 (the internal line is derived), F27 (the ghost is not the value),
 * and the duplicated draft, which was measured in a browser: the visitor's sentence
 * rendered once in the pending bubble and once in a separate composer box below it.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { COMPANY_RULES } from "@/app/lib/policies";
import type { Finding, PolicyRule, Severity } from "@/app/lib/types";
import type { EngineStatus } from "@/app/lib/useEngine";
import {
  COMPOSER_LABEL,
  Composer,
  DraftField,
  EXAMPLE_REPLIES,
  GHOST_HINT,
  GHOST_INSERT,
  applyReplacement,
  occurrences,
  sendLabel,
  statusLine,
  suppressionKey,
  tidySpacing,
  visibleFindings,
} from "./Composer";
import {
  GuidancePanel,
  cappedFindings,
  findingsInScope,
  hasGuidanceContent,
  internalGuidanceLine,
  orderedFindings,
  overflowLine,
  scopedCategories,
} from "./GuidancePanel";
import { PendingDraft } from "./PendingDraft";
import { THREAD_EXTERNAL, THREAD_INTERNAL, Thread } from "./Thread";
import { visibleProvenance } from "./FindingCard";

const PROMISE_TEXT = "Yes, we guarantee your data never leaves the US.";

function finding(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: "residency-promise",
    ruleSource: "company",
    title: "An unconditional promise about where data is stored",
    severity: "high",
    category: "claim",
    why: "Where data lives depends on the deployment. An unconditional promise commits you.",
    replacement: "Our data-residency options depend on your deployment and contract terms.",
    matchedText: PROMISE_TEXT,
    start: 0,
    end: PROMISE_TEXT.length,
    source: "semantic",
    score: 0.74,
    ...over,
  };
}

const READY: EngineStatus = { kind: "ready", device: "webgpu", demoted: false, loadMs: 1800 };

describe("statusLine", () => {
  it("reports a real percentage while booting, plus the reason for the wait", () => {
    const line = statusLine({ kind: "booting", pct: 34 }, null);
    expect(line.text).toBe("Getting ready. This downloads once. 34%");
    expect(line.detail).toContain("The checker runs on your computer");
  });

  it("shows plain language when ready, with technical proof in disclosure fields", () => {
    const line = statusLine(READY, 0);
    expect(line.text).toBe("Checking as you type. Nothing has left your computer.");
    expect(line.device).toBe("webgpu");
    expect(line.requestCount).toBe(0);
  });

  /**
   * The fake zero this product's whole claim would die on. `requestsSinceReady`
   * is null while a download is in flight, and a zero beside a running download
   * is a number the app cannot vouch for.
   */
  it("never renders a count while the engine reports null", () => {
    const line = statusLine(READY, null);
    expect(line.text).toBe("Downloading. Nothing you type is being sent.");
    expect(line.kind).toBe("downloading");
  });

  it("says simple checks still run when the encoder failed", () => {
    expect(statusLine({ kind: "degraded", reason: "no wasm" }, null).text).toBe(
      "Full checking isn't available in this browser. The simple checks are still running.",
    );
  });
});

describe("sendLabel", () => {
  it("changes only for an unresolved high finding", () => {
    expect(sendLabel([])).toBe("Send");
    expect(sendLabel([finding({ severity: "medium" })])).toBe("Send");
    expect(sendLabel([finding({ severity: "low" })])).toBe("Send");
    expect(sendLabel([finding({ severity: "high" })])).toBe("Send anyway");
  });
});

describe("applyReplacement", () => {
  it("replaces at the stored span when it still matches", () => {
    const draft = `Hi Sam. ${PROMISE_TEXT} Thanks.`;
    const at = draft.indexOf(PROMISE_TEXT);
    const next = applyReplacement(
      draft,
      { matchedText: PROMISE_TEXT, start: at, end: at + PROMISE_TEXT.length },
      "We can share the specifics.",
    );
    expect(next).toBe("Hi Sam. We can share the specifics. Thanks.");
  });

  /**
   * F9. Two findings can legitimately share (ruleId, matchedText), so matching on
   * text alone rewrites the FIRST occurrence and the visitor watches the wrong
   * paragraph change while the card they clicked reappears.
   */
  it("replaces the occurrence nearest the stored span when the span has shifted", () => {
    const draft = `${PROMISE_TEXT} Legal will confirm. To be clear: ${PROMISE_TEXT}`;
    const second = draft.lastIndexOf(PROMISE_TEXT);
    // Offsets are stale by one character, so step 1 misses and step 2 decides.
    const next = applyReplacement(
      draft,
      { matchedText: PROMISE_TEXT, start: second + 1, end: second + 1 + PROMISE_TEXT.length },
      "REPLACED",
    );
    expect(next).toBe(`${PROMISE_TEXT} Legal will confirm. To be clear: REPLACED`);
  });

  it("abandons when the text is gone, so the caller can re-scan instead of guessing", () => {
    expect(applyReplacement("A different draft entirely.", finding(), "x")).toBeNull();
    expect(applyReplacement("anything", { matchedText: "", start: 0, end: 0 }, "x")).toBeNull();
  });

  it("finds every occurrence without overlapping", () => {
    expect(occurrences("aa aa aa", "aa")).toEqual([0, 3, 6]);
    expect(occurrences("nothing here", "zz")).toEqual([]);
  });

  it("tidies the spacing a removed term leaves behind", () => {
    const draft = "we damn well guarantee it";
    const next = applyReplacement(
      draft,
      { matchedText: "damn", start: 3, end: 7 },
      "",
    );
    expect(tidySpacing(next as string)).toBe("we well guarantee it");
    expect(tidySpacing("ends here , then")).toBe("ends here, then");
  });
});

describe("visibleFindings", () => {
  it("drops a finding whose text the visitor has edited away", () => {
    const draft = "Our options depend on the contract.";
    expect(visibleFindings([finding()], draft, new Set())).toHaveLength(0);
    expect(visibleFindings([finding()], PROMISE_TEXT, new Set())).toHaveLength(1);
  });

  /** §8.2: the key is (rule, exact text), so keeping your wording removes both cards. */
  it("suppresses every occurrence of the same rule and text", () => {
    const draft = `${PROMISE_TEXT} Again: ${PROMISE_TEXT}`;
    const both = [finding(), finding({ start: draft.lastIndexOf(PROMISE_TEXT) })];
    const suppressed = new Set([suppressionKey(both[0])]);
    expect(visibleFindings(both, draft, suppressed)).toHaveLength(0);
    // A different rule on the same sentence is untouched.
    const other = finding({ ruleId: "strong-language", severity: "low" });
    expect(visibleFindings([...both, other], draft, suppressed)).toEqual([other]);
  });
});

describe("card ordering and the three-card cap", () => {
  const at = (severity: Severity, start: number) =>
    finding({ severity, start, end: start + PROMISE_TEXT.length });

  it("orders by severity, then by position in the draft", () => {
    const ordered = orderedFindings([at("low", 0), at("high", 90), at("medium", 10), at("high", 5)]);
    expect(ordered.map((f) => [f.severity, f.start])).toEqual([
      ["high", 5],
      ["high", 90],
      ["medium", 10],
      ["low", 0],
    ]);
  });

  it("shows three and counts the rest", () => {
    const { shown, overflow } = cappedFindings([
      at("high", 0),
      at("medium", 10),
      at("medium", 20),
      at("low", 30),
      at("low", 40),
    ]);
    expect(shown).toHaveLength(3);
    expect(overflow).toBe(2);
    expect(overflowLine(overflow)).toBe("2 more further down your message.");
  });
});

describe("the internal line is derived from the effective rule set", () => {
  it("names what is off and what is on, from the shipped rules", () => {
    const line = internalGuidanceLine(COMPANY_RULES);
    expect(line.startsWith("Internal conversation. ")).toBe(true);
    expect(line).toContain("checks are off");
    expect(line).toContain("tone");
    expect(line).toContain("checks are on");
    // Derivation, not a literal: tone and language are the internal categories.
    expect(line).toBe(
      "Internal conversation. Claim, commitment and channel checks are off, " +
        "tone and language checks are on.",
    );
  });

  /**
   * F26. Three documents once carried three different literal strings for this
   * line, and the stale one said checks apply only outside the company, which
   * would have rendered directly above a tone card. Turning a rule off has to
   * move the line, or it is a literal again.
   */
  it("moves when a rule is switched off", () => {
    const withoutTone: PolicyRule[] = COMPANY_RULES.map((rule) =>
      rule.category === "tone" ? { ...rule, enabled: false } : rule,
    );
    const line = internalGuidanceLine(withoutTone);
    expect(line).toContain("tone checks are off");
    expect(line).toContain("language checks are on");
  });

  it("falls through to the no-rules line when nothing is enabled", () => {
    const allOff: PolicyRule[] = COMPANY_RULES.map((rule) => ({ ...rule, enabled: false }));
    expect(internalGuidanceLine(allOff)).toBe("No rules are switched on.");
  });
});

describe("findingsInScope", () => {
  it("drops the commitment findings and keeps the tone ones on a switch to internal", () => {
    const residency = finding();
    const tone = finding({ ruleId: "harsh-criticism", category: "tone", severity: "medium" });
    expect(findingsInScope([residency, tone], COMPANY_RULES, "internal")).toEqual([tone]);
    expect(findingsInScope([residency, tone], COMPANY_RULES, "external-domain")).toHaveLength(2);
  });

  it("scopes the shipped rules the way the two threads assume", () => {
    expect([...scopedCategories(COMPANY_RULES, "internal")].sort()).toEqual([
      "language",
      "tone",
    ]);
  });
});

/**
 * F25. The switcher swaps which thread is rendered, and the internal thread must
 * not contain `example.com` anywhere: not a participant, not a message, not a
 * badge. With the external conversation still on screen, "master switch" is the
 * literally correct reading of what the visitor sees, and the product's central
 * gesture becomes a checkbox.
 */
describe("the two seeded threads", () => {
  const render = (thread: typeof THREAD_INTERNAL) =>
    renderToStaticMarkup(<Thread thread={thread} onReset={() => {}} />);

  it("keeps example.com out of the internal thread entirely", () => {
    const markup = render(THREAD_INTERNAL);
    expect(markup).not.toContain("example.com");
    expect(markup).not.toContain("Sam");
    expect(markup).toContain("Platform team");
    expect(markup).toContain("Priya");
  });

  it("shows the external badge and Sam's messages on the external thread", () => {
    const markup = render(THREAD_EXTERNAL);
    expect(markup).toContain("External · example.com");
    expect(markup).toContain("Q3 evaluation");
    expect(markup).toContain("can you confirm our data stays inside the US?");
    // The third message is what supplies the time pressure.
    expect(markup).toContain("before Thursday");
  });

  it("gives the internal thread no badge at all", () => {
    expect(THREAD_INTERNAL.badge).toBeUndefined();
    expect(THREAD_EXTERNAL.badge).toBeDefined();
  });
});

describe("the example replies", () => {
  it("offers three in each thread", () => {
    expect(EXAMPLE_REPLIES.external).toHaveLength(3);
    expect(EXAMPLE_REPLIES.internal).toHaveLength(3);
  });

  /**
   * The third example is the important one. A visitor who only ever sees the
   * product fire has no evidence it stays quiet, and staying quiet is most of the
   * credibility. Its silence is structural rather than lucky: a semantic rule
   * fires only when one of its own cues is present, so a sentence carrying no cue
   * of any rule cannot fire at any threshold.
   */
  it("includes one that cannot produce guidance at any threshold", () => {
    for (const mode of ["external", "internal"] as const) {
      const calm = EXAMPLE_REPLIES[mode].find((example) => example.id === "calm");
      expect(calm).toBeDefined();
      const text = (calm as { text: string }).text.toLowerCase();

      for (const rule of COMPANY_RULES) {
        if (rule.match.kind === "semantic") {
          for (const cue of rule.match.cues) {
            expect(text).not.toContain(cue.toLowerCase());
          }
        } else {
          for (const term of rule.match.terms) {
            expect(text).not.toMatch(new RegExp(`\\b${term}\\b`));
          }
        }
      }
      // Nothing the deterministic rung looks for either: no address shape, no
      // digit run long enough to be a phone number, card, or key.
      expect(text).not.toContain("@");
      expect(text).not.toMatch(/\d/);
    }
  });

  it("leads the internal thread with an example that can actually fire there", () => {
    const first = EXAMPLE_REPLIES.internal[0];
    const tone = COMPANY_RULES.find((rule) => rule.category === "tone");
    expect(tone?.match.kind).toBe("semantic");
    if (tone?.match.kind !== "semantic") return;
    const hit = tone.match.cues.some((cue) => first.text.toLowerCase().includes(cue));
    expect(hit).toBe(true);
  });
});

/**
 * The actions row, measured in a browser before this pass and wrong twice.
 *
 * Send was filled with the accent on a fresh load and was not disabled, so the most
 * emphasised control in the product did nothing at all until something was typed.
 * And the three example pills carried an `aria-label` and no visible label, so a
 * screen reader was told what they were and a sighted visitor was left guessing
 * between filters, tags and buttons.
 *
 * These assertions are on the requirement rather than on the class names: the fill
 * that marks the primary state is read out of the enabled render itself, so renaming
 * a token moves both sides together and cannot make the test pass falsely.
 */
describe("the actions row", () => {
  const row = (draftEmpty: boolean, findings: readonly Finding[] = []) =>
    renderToStaticMarkup(
      <Composer
        mode="external"
        status={READY}
        requestsSinceReady={0}
        findings={findings}
        draftEmpty={draftEmpty}
        onInsert={() => {}}
        onSend={() => {}}
      />,
    );

  /** Send's own opening tag, found by the reserve label only Send carries. */
  const sendTag = (markup: string) => {
    const opens = markup.lastIndexOf("<button", markup.indexOf("Send anyway"));
    return markup.slice(opens, markup.indexOf(">", opens) + 1);
  };
  const classOf = (tag: string) => /class="([^"]*)"/.exec(tag)?.[1] ?? "";
  const disabled = (tag: string) => /\sdisabled(=|\s|>)/.test(tag);
  /** The one label that is not the `aria-hidden` width reserve. */
  const words = (markup: string) => /text-center">([^<]*)</.exec(markup)?.[1];

  const FILL = /bg-accent[\w-]*/.exec(classOf(sendTag(row(false))))?.[0];

  it("has a fill to lose in the first place", () => {
    expect(FILL).toBeDefined();
  });

  it("is enabled and filled once there is something to send", () => {
    const tag = sendTag(row(false));
    expect(disabled(tag)).toBe(false);
    expect(classOf(tag)).toContain(FILL as string);
  });

  it("is disabled and unfilled while the draft is empty", () => {
    const tag = sendTag(row(true));
    expect(disabled(tag)).toBe(true);
    expect(classOf(tag)).not.toContain(FILL as string);
  });

  /**
   * Empty outranks the high state, and this is the case that could only be reached
   * by the two inputs disagreeing for a frame. It still has to read `Send` rather
   * than `Send anyway`, which on a control that cannot send would be a taunt, and
   * the note line must not appear.
   */
  it("keeps the plain word and stays shut when empty meets a high finding", () => {
    const markup = row(true, [finding({ severity: "high" })]);
    expect(disabled(sendTag(markup))).toBe(true);
    expect(words(markup)).toBe("Send");
    expect(markup).not.toContain("Add a note for yourself");
  });

  /**
   * The visible label, and the announced name resolving to it. Two names for one
   * control is how the two drift apart, so the `aria-label` has to be gone rather
   * than merely matching.
   */
  it("labels the example pills on screen and announces the same words", () => {
    const markup = row(true);
    expect(markup).toContain("Try one of these");

    const group = /<div role="group"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(group).not.toContain("aria-label=");
    const id = /aria-labelledby="([^"]+)"/.exec(group)?.[1];
    expect(id).toBeDefined();

    const labelled = new RegExp(`<[^>]*id="${id}"[^>]*>([^<]*)<`).exec(markup);
    expect(labelled?.[1]).toBe("Try one of these");
  });
});

/**
 * F27. The hint is display-only and the inserted sentence is the bare one, so the
 * `Try: "…"` wrapper can never reach the draft. If the ghost were the textarea's
 * value, the scan that fires on reaching `ready` would render a high-severity
 * card under an untouched composer.
 */
describe("the ghost hint", () => {
  it("inserts the sentence without its display wrapper", () => {
    expect(GHOST_HINT).toBe('Try: "Yes, we guarantee your data never leaves the US."');
    expect(GHOST_INSERT).toBe(PROMISE_TEXT);
    expect(GHOST_HINT).not.toBe(GHOST_INSERT);
    expect(GHOST_HINT).toContain(GHOST_INSERT.slice(0, -1));
  });
});

/**
 * The draft is on screen exactly once, and the field is the bubble.
 *
 * Measured in a browser before this pass: the sentence appeared in the pending
 * bubble AND in a textarea in a bordered box underneath it, so a visitor read their
 * own words twice and the bubble looked like a preview of a form field rather than
 * the message it is. These tests hold the structure that fixed it.
 *
 * The measuring twin inside the field is stripped before counting. It is
 * `aria-hidden` and `visibility: hidden`, so it is not on screen and not in the
 * accessibility tree; it exists only so the field can be exactly as tall as its text
 * without an effect that reads `scrollHeight` on every keystroke.
 */
describe("one field, one copy of the draft", () => {
  const stripTwins = (markup: string) =>
    markup.replace(/<div aria-hidden="true"[\s\S]*?<\/div>/g, "");

  /**
   * `withGuidance` is off for the counting test on purpose. A card QUOTES the
   * sentence it is about (§7), which is a second appearance of the same string and
   * a deliberate one: the quotation is what says which words the card means. The
   * defect was the field's copy, so the count is taken with the guidance zone empty.
   */
  const surface = (draft: string, withGuidance = true) =>
    renderToStaticMarkup(
      <PendingDraft
        severity={draft === "" || !withGuidance ? undefined : "high"}
        hasGuidance={draft !== "" && withGuidance}
        field={
          <DraftField
            draft={draft}
            textareaRef={{ current: null }}
            onDraftChange={() => {}}
            onInsert={() => {}}
          />
        }
      >
        <GuidancePanel
          findings={draft === "" || !withGuidance ? [] : [finding()]}
          rules={COMPANY_RULES}
          kind="external-domain"
          truncated={false}
          clean={false}
          hasDraft={draft !== "" && withGuidance}
          onAccept={() => {}}
          onKeep={() => {}}
        />
      </PendingDraft>,
    );

  const furniture = () =>
    renderToStaticMarkup(
      <Composer
        mode="external"
        status={READY}
        requestsSinceReady={0}
        findings={[finding()]}
        draftEmpty={false}
        onInsert={() => {}}
        onSend={() => {}}
      />,
    );

  it("renders the visitor's sentence once across the surface and the furniture", () => {
    const markup = stripTwins(surface(PROMISE_TEXT, false)) + furniture();
    expect(occurrences(markup, PROMISE_TEXT)).toHaveLength(1);
  });

  /** With a card open the second appearance is the card's quotation, and no more. */
  it("adds only the card's own quotation when guidance is open", () => {
    const markup = stripTwins(surface(PROMISE_TEXT)) + furniture();
    expect(occurrences(markup, PROMISE_TEXT)).toHaveLength(2);
    expect(markup).toContain(`“${PROMISE_TEXT}”`);
  });

  /** The composer below the surface has no field of its own left to duplicate into. */
  it("leaves no textarea outside the pending surface", () => {
    expect(furniture()).not.toContain("<textarea");
    expect(surface(PROMISE_TEXT)).toContain("<textarea");
  });

  it("keeps the field's accessible name", () => {
    expect(surface("")).toContain(`aria-label="${COMPOSER_LABEL}"`);
    expect(surface(PROMISE_TEXT)).toContain(`aria-label="${COMPOSER_LABEL}"`);
  });

  /**
   * No box of its own, because the surface is the box. A bordered field inside a
   * bordered bubble is the nested card this design system bans outright, and it is
   * what made the duplicate read as two separate objects.
   */
  it("gives the field no border, no background and no padding of its own", () => {
    const markup = surface(PROMISE_TEXT);
    const field = markup.slice(markup.indexOf("<textarea"));
    expect(field).toContain("border-0");
    expect(field).toContain("bg-transparent");
    expect(field).toContain("p-0");
    // Auto-grown by the twin, so the drag handle would fight the measurement.
    expect(field).toContain("resize-none");
  });

  /**
   * The focus ring is on the surface, and there is exactly one of them. `:has()`
   * rather than `focus-within`, or the accept and reject buttons inside the surface
   * would light the whole bubble up alongside their own ring.
   */
  it("puts the focus treatment on the surface and not inside it", () => {
    const markup = surface(PROMISE_TEXT);
    expect(markup).toContain("has-[textarea:focus-visible]:outline-2");
    expect(markup).toContain("has-[textarea:focus-visible]:outline-accent");
    expect(markup).not.toContain("focus-within:");
    const field = markup.slice(markup.indexOf("<textarea"));
    expect(field).toContain("focus-visible:outline-hidden");
  });

  /** F27, in its new home: the hint is display-only and never the field's value. */
  it("shows the ghost hint only while the field is empty", () => {
    // The hint carries quotation marks, which `renderToStaticMarkup` escapes.
    const escaped = GHOST_HINT.replaceAll('"', "&quot;");
    expect(surface("")).toContain(escaped);
    // Empty means empty: the hint is not the value, so the textarea is bare.
    expect(surface("")).toContain("></textarea>");
    const typed = surface(PROMISE_TEXT, false);
    expect(typed).not.toContain(escaped);
    expect(typed).toContain(GHOST_INSERT);
  });
});

/**
 * §5.2: an empty draft shows the status line and nothing else.
 *
 * This used to be free, because the pending surface only mounted once there was a
 * character in the draft. The surface now holds the field and is always mounted, so
 * the rule has to be stated: without it the internal thread would open a guidance
 * zone under an empty field on first paint and name six categories before the
 * visitor had typed anything.
 */
describe("guidance needs a draft", () => {
  const args = { findings: [], truncated: false, clean: false } as const;

  it("stays shut on an empty draft, including on the internal thread", () => {
    expect(hasGuidanceContent({ ...args, hasDraft: false, kind: "internal" })).toBe(false);
    expect(hasGuidanceContent({ ...args, hasDraft: false, clean: true, kind: "external-domain" })).toBe(
      false,
    );
    expect(
      hasGuidanceContent({ ...args, hasDraft: false, findings: [finding()], kind: "external-domain" }),
    ).toBe(false);
  });

  it("opens as soon as there is one", () => {
    expect(hasGuidanceContent({ ...args, hasDraft: true, kind: "internal" })).toBe(true);
    expect(
      hasGuidanceContent({ ...args, hasDraft: true, findings: [finding()], kind: "external-domain" }),
    ).toBe(true);
    expect(hasGuidanceContent({ ...args, hasDraft: true, kind: "external-domain" })).toBe(false);
  });

  it("renders nothing but the live region while the draft is empty", () => {
    const markup = renderToStaticMarkup(
      <GuidancePanel
        findings={[]}
        rules={COMPANY_RULES}
        kind="internal"
        truncated={false}
        clean={false}
        hasDraft={false}
        onAccept={() => {}}
        onKeep={() => {}}
      />,
    );
    expect(markup).toContain('aria-live="polite"');
    expect(markup).not.toContain("Internal conversation");
  });
});

/**
 * §14's banned list, checked against every string this task can reach rather than
 * trusted to review. Each banned word either accuses the visitor or overclaims the
 * product, and both are failure modes here.
 */
describe("the words this product does not use", () => {
  const BANNED = [
    "violation",
    "breach",
    "illegal",
    "non-compliant",
    "error",
    "warning",
    "alert",
    "risk score",
    "blocked",
    "prevented",
    "forbidden",
    "you must",
    "you should not",
    "offence",
    "misconduct",
  ];

  it("appears in none of them", () => {
    const strings = [
      statusLine({ kind: "booting", pct: 7 }, null).text,
      statusLine({ kind: "booting", pct: 7 }, null).detail ?? "",
      statusLine(READY, 0).text,
      statusLine(READY, null).text,
      statusLine({ kind: "degraded", reason: "x" }, null).text,
      sendLabel([]),
      sendLabel([finding()]),
      internalGuidanceLine(COMPANY_RULES),
      internalGuidanceLine(COMPANY_RULES.map((r) => ({ ...r, enabled: false }))),
      overflowLine(2),
      GHOST_HINT,
      GHOST_INSERT,
      visibleProvenance(),
      ...EXAMPLE_REPLIES.external.flatMap((e) => [e.label, e.text]),
      ...EXAMPLE_REPLIES.internal.flatMap((e) => [e.label, e.text]),
      renderToStaticMarkup(<Thread thread={THREAD_EXTERNAL} onReset={() => {}} />),
      renderToStaticMarkup(<Thread thread={THREAD_INTERNAL} onReset={() => {}} />),
    ];

    for (const value of strings) {
      for (const word of BANNED) {
        expect(value.toLowerCase()).not.toContain(word);
      }
    }
  });
});

/**
 * Technical terminology belongs in disclosures, not in always-visible labels.
 * This is the product's argument: readable claims in front, verifiable proof behind.
 */
describe("no technical jargon in always-visible labels", () => {
  const BANNED_TECHNICAL = [
    "webgpu",
    "wasm",
    "network request",
    "model",
    "embedding",
    "semantic",
    "threshold",
    "confidence score",
    "inference",
    "pattern check",
    "wording check",
    "device",
  ];

  it("keeps technical terms out of primary status and provenance lines", () => {
    const alwaysVisible = [
      statusLine({ kind: "booting", pct: 7 }, null).text,
      statusLine(READY, 0).text,
      statusLine(READY, null).text,
      statusLine({ kind: "degraded", reason: "x" }, null).text,
      visibleProvenance(),
    ];

    for (const value of alwaysVisible) {
      for (const word of BANNED_TECHNICAL) {
        expect(value.toLowerCase()).not.toContain(word);
      }
    }
  });
});
