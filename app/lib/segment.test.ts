/**
 * Segmentation tests. The table is T2.4's acceptance list, row for row.
 *
 * The universal invariant at the bottom is the point of the whole file:
 * `draft.slice(start, end) === segment.text` for every segment of every case,
 * asserted once over the shared table rather than case by case, so a new row
 * cannot be added without inheriting the offset check that the composer's
 * highlight and replace paths depend on.
 */

import { describe, expect, it } from "vitest";
import type { Segment } from "@/app/lib/types";
import {
  MAX_SEGMENTS,
  MAX_SEGMENT_CHARS,
  clauseSpans,
  embeddingText,
  maskExcisions,
  segment,
} from "./segment";

type Case = {
  name: string;
  draft: string;
  /** Exact expected texts, when the whole list is what matters. */
  texts?: string[];
  count?: number;
  truncated?: boolean;
  check?: (segments: Segment[]) => void;
};

const FORTY_FIVE = Array.from(
  { length: 45 },
  (_, i) => `This is sentence number ${i} of the draft.`,
).join(" ");

const RUN_ON =
  "hey quick update on the pilot we guarantee your data never leaves the US, " +
  "and the security review is fully wrapped up on our side, but the DPA still " +
  "needs a signature from your legal team, so I will chase that tomorrow " +
  "morning and send over the SOC 2 report along with the architecture diagram as well";

const NO_BOUNDARY_RUN_ON = `${"the pilot rollout plan keeps moving around a lot ".repeat(6)}and nobody has written any of it down yet`;

const CASES: Case[] = [
  {
    name: "no terminal punctuation is one segment, not zero",
    draft: "we guarantee your data never leaves the US",
    texts: ["we guarantee your data never leaves the US"],
    truncated: false,
  },
  {
    name: "a fenced code block is excised, the prose around it survives",
    draft:
      'We guarantee no leaks anywhere.\n```\nconst apiKey = "we guarantee";\n```\nHere is the plan for tomorrow.',
    texts: ["We guarantee no leaks anywhere.", "Here is the plan for tomorrow."],
    check: (segments) => {
      expect(segments.some((s) => s.text.includes("apiKey"))).toBe(false);
    },
  },
  {
    name: "an inline backticked span is excised for embedding but kept in the text",
    draft: "The `guarantee_mode` flag is off so nothing is promised here.",
    count: 1,
    check: (segments) => {
      expect(segments[0].text).toContain("`guarantee_mode`");
      expect(embeddingText(segments[0].text)).not.toContain("guarantee_mode");
    },
  },
  {
    name: "a bare URL is excised and its dots are not sentence boundaries",
    draft:
      "Our residency policy lives at https://example.com/docs/data-residency and it explains the region setup.",
    count: 1,
    check: (segments) => {
      expect(embeddingText(segments[0].text)).not.toContain("https");
    },
  },
  {
    name: "a leading URL is excluded from the span entirely",
    draft:
      "https://example.com/docs/data-residency explains where the region setup lives.",
    check: (segments) => {
      expect(segments).toHaveLength(1);
      expect(segments[0].start).toBe(
        "https://example.com/docs/data-residency ".length,
      );
      expect(segments[0].text).toBe("explains where the region setup lives.");
    },
  },
  {
    name: "an emoji stays in the text and leaves the embedding",
    draft: "We guarantee no leaks \u{1F389} and everything stays inside the US \u{1F512}",
    count: 1,
    check: (segments) => {
      expect(segments[0].text).toContain("\u{1F389}");
      expect(embeddingText(segments[0].text)).toBe(
        "We guarantee no leaks and everything stays inside the US",
      );
    },
  },
  {
    name: "45 sentences are capped at 40 and reported as truncated",
    draft: FORTY_FIVE,
    count: MAX_SEGMENTS,
    truncated: true,
    check: (segments) => {
      expect(segments[0].text).toBe("This is sentence number 0 of the draft.");
      expect(segments[39].text).toBe("This is sentence number 39 of the draft.");
    },
  },
  {
    name: "whitespace only yields zero segments, not one empty one",
    draft: "   \n\t  \n ",
    texts: [],
    truncated: false,
  },
  {
    name: "punctuation only yields zero segments",
    draft: "... !!! ;; . ?!",
    texts: [],
  },
  {
    name: "a 14-character fragment is skipped",
    draft: "we said maybe.",
    texts: [],
  },
  {
    name: "21 characters is not a fragment, which is why the bound is characters",
    draft: "we guarantee no leaks",
    texts: ["we guarantee no leaks"],
  },
  {
    name: "a compound sentence joined by `, and` splits into two clauses",
    draft:
      "Yes, we guarantee your data never leaves the US, and I'll send over the SOC 2 report tomorrow.",
    texts: [
      "Yes, we guarantee your data never leaves the US",
      "and I'll send over the SOC 2 report tomorrow.",
    ],
  },
  {
    name: "a 300-character run-on splits at its soft boundaries",
    draft: RUN_ON,
    check: (segments) => {
      expect(RUN_ON.length).toBeGreaterThanOrEqual(300);
      expect(segments).toHaveLength(4);
      expect(segments[0].text).toBe(
        "hey quick update on the pilot we guarantee your data never leaves the US",
      );
      expect(segments[1].text.startsWith("and the security review")).toBe(true);
      expect(segments[2].text.startsWith("but the DPA")).toBe(true);
      expect(segments[3].text.startsWith("so I will chase")).toBe(true);
    },
  },
  {
    name: "a long run with no boundary at all is still bounded in length",
    draft: NO_BOUNDARY_RUN_ON,
    check: (segments) => {
      expect(segments.length).toBeGreaterThan(1);
      for (const s of segments) {
        expect(embeddingText(s.text).length).toBeLessThanOrEqual(
          MAX_SEGMENT_CHARS,
        );
      }
    },
  },
  {
    name: "newline and semicolon are hard boundaries",
    draft: "we guarantee no leaks; nothing escapes\nthe region never changes here",
    texts: [
      "we guarantee no leaks;",
      "nothing escapes",
      "the region never changes here",
    ],
  },
  {
    name: "an unbroken token wall cannot swallow the clause after it",
    // No comma and no space inside the first 200 characters, so the comma and
    // word-boundary cuts both come up empty. Without a fixed-width reserve cut
    // the promise clause would sit inside one 309-character segment: finding
    // F2's dilution, reintroduced by the length guard's own fallback.
    draft: `${"x".repeat(250)} and then we guarantee your data never leaves the US at all`,
    check: (segments) => {
      expect(segments.length).toBeGreaterThan(1);
      expect(segments.at(-1)?.text).toContain("we guarantee your data");
    },
  },
  {
    name: "a single 500-character word is still bounded",
    draft: "a".repeat(500),
    check: (segments) => {
      expect(segments.length).toBeGreaterThan(1);
    },
  },
  {
    name: "`, then` and `, which` are soft boundaries too",
    draft:
      "I will confirm the region with the platform team, then send you the DPA, which our counsel already signed.",
    texts: [
      "I will confirm the region with the platform team",
      "then send you the DPA",
      "which our counsel already signed.",
    ],
  },
  {
    name: "exactly 40 segments is not truncated",
    draft: Array.from(
      { length: MAX_SEGMENTS },
      (_, i) => `This is sentence number ${i} of the draft.`,
    ).join(" "),
    count: MAX_SEGMENTS,
    truncated: false,
  },
  {
    name: "`, sometimes` is not the `, so` boundary",
    draft: "we ship on Friday, sometimes earlier than that",
    count: 1,
  },
  {
    name: "a decimal point is not a sentence boundary",
    draft: "the p95 latency is 1.5 seconds under a normal load",
    count: 1,
  },
];

describe("segment", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const result = segment(c.draft);
      if (c.texts) expect(result.segments.map((s) => s.text)).toEqual(c.texts);
      if (c.count !== undefined) expect(result.segments).toHaveLength(c.count);
      if (c.truncated !== undefined) expect(result.truncated).toBe(c.truncated);
      c.check?.(result.segments);
    });
  }
});

/**
 * The invariant, over every row. Offsets index the original draft, spans are
 * ordered and non-overlapping, and nothing carries surrounding whitespace. A
 * violation here means the composer would highlight or replace the wrong range,
 * which is the failure mode this module exists to prevent.
 */
describe("offset invariant", () => {
  for (const c of CASES) {
    it(`holds for: ${c.name}`, () => {
      const { segments } = segment(c.draft);
      let previousEnd = -1;
      for (const s of segments) {
        expect(c.draft.slice(s.start, s.end)).toBe(s.text);
        expect(s.end).toBeGreaterThan(s.start);
        expect(s.start).toBeGreaterThanOrEqual(previousEnd);
        expect(s.text).toBe(s.text.trim());
        previousEnd = s.end;
      }
    });
  }
});

/**
 * The dilution bound, over every row rather than the one row that names it. A
 * segment longer than this has already averaged its own promise away, so a
 * length-guard fallback that quietly gives up on some shape of input has to
 * fail here rather than in production.
 */
describe("dilution bound", () => {
  for (const c of CASES) {
    it(`holds for: ${c.name}`, () => {
      for (const s of segment(c.draft).segments) {
        expect(embeddingText(s.text).length).toBeLessThanOrEqual(
          MAX_SEGMENT_CHARS,
        );
      }
    });
  }
});

describe("maskExcisions", () => {
  it("preserves length so an index into the mask is an index into the original", () => {
    for (const c of CASES) {
      expect(maskExcisions(c.draft)).toHaveLength(c.draft.length);
    }
  });

  it("keeps newlines, because a newline is a hard boundary", () => {
    const masked = maskExcisions("a\n```\nlet x = 1\n```\nb");
    expect(masked).toBe("a\n   \n         \n   \nb");
  });

  it("leaves the sentence period outside the URL it follows", () => {
    const masked = maskExcisions("see https://example.com/x. next");
    expect(masked).toBe("see                      . next");
  });

  it("handles an unterminated fence rather than ignoring it", () => {
    const masked = maskExcisions("ok\n```\nsecret = 1");
    expect(masked.includes("secret")).toBe(false);
  });
});

describe("embeddingText", () => {
  it("strips markdown emphasis while the original keeps it", () => {
    expect(embeddingText("we **guarantee** the _region_ never changes")).toBe(
      "we guarantee the region never changes",
    );
  });

  it("collapses the whitespace left behind by an excision", () => {
    expect(embeddingText("read `config.yaml` first")).toBe("read first");
  });
});

describe("clauseSpans", () => {
  it("is the shared clause definition: no minimum length, no cap", () => {
    const spans = clauseSpans("we said maybe. ok");
    expect(spans.map((s) => s.text)).toEqual(["we said maybe.", "ok"]);
    expect(clauseSpans(FORTY_FIVE)).toHaveLength(45);
  });

  it("carries the same offset invariant, since negation scopes with it", () => {
    for (const c of CASES) {
      for (const s of clauseSpans(c.draft)) {
        expect(c.draft.slice(s.start, s.end)).toBe(s.text);
      }
    }
  });
});

