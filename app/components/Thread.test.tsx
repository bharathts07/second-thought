/**
 * The demo participants, and the hydration bug that pinned them.
 *
 * The names are drawn from a set of common first names so the conversation does not
 * read as canned. The first attempt did that with `Math.random()` at module scope in
 * `Thread.tsx`, under a comment asserting that module scope "avoids hydration
 * mismatches entirely" because it runs before render.
 *
 * That was measurably backwards. `Thread.tsx` is in the client bundle, so its module
 * scope runs a SECOND time in the browser and drew a different pair: the prerendered
 * HTML said Skylar and Casey, the browser said something else, and every page load
 * logged React error #418, a hydration text mismatch. The full suite passed and the
 * build succeeded the whole time, which is exactly why this file exists.
 *
 * A unit test cannot observe hydration, because there are two realms and vitest has
 * one. So these assert the PROPERTY that makes the mismatch impossible: the names are
 * a pure function of a build-time seed, with nothing non-deterministic in the path.
 * Get that right and the two realms cannot disagree; get it wrong and they always
 * eventually will.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  PARTICIPANT_INTERNAL,
  PARTICIPANT_EXTERNAL,
  SEEDED_THREADS,
} from "./Thread";

const source = readFileSync(new URL("./Thread.tsx", import.meta.url), "utf8");

/**
 * Comments stripped before asserting, because the first version of this test failed
 * on the comment that documents the bug. Thread.tsx explains at length why
 * `Math.random()` must not appear in its module scope, and a bare substring search
 * cannot tell an explanation from a call.
 *
 * That is the same class of mistake as the bug it guards: an instrument that looks
 * like it measures the thing but does not. Prose about a hazard has to be allowed to
 * name the hazard.
 */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\/\/[^\n]*/g, " ");

describe("the demo participants", () => {
  it("gives the two people different names", () => {
    expect(PARTICIPANT_INTERNAL).not.toBe(PARTICIPANT_EXTERNAL);
  });

  it("uses a bare first name for each, never a full name", () => {
    for (const name of [PARTICIPANT_INTERNAL, PARTICIPANT_EXTERNAL]) {
      expect(name).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  /**
   * The regression, stated as a source constraint because the failure it caused was
   * cross-realm and no single-realm test can see it.
   */
  it("draws no randomness in the module that renders, which is what broke hydration", () => {
    expect(code).not.toContain("Math.random");
    expect(code).not.toContain("Date.now");
  });

  it("derives the pick from the build-time seed the bundler inlines into both realms", () => {
    expect(code).toContain("NEXT_PUBLIC_NAME_SEED");
  });

  /**
   * A reply signed by somebody who is not in the conversation is worse than a
   * hardcoded name, so every surface that shows a name reads the same two exports.
   */
  it("uses the same pair everywhere a name appears", () => {
    for (const thread of Object.values(SEEDED_THREADS)) {
      expect(thread.participants).toContain(PARTICIPANT_INTERNAL);

      for (const message of thread.messages) {
        if (message.mine) continue;
        expect(
          [PARTICIPANT_INTERNAL, PARTICIPANT_EXTERNAL],
          `message from "${message.from}" names nobody in the thread`,
        ).toContain(message.from);
      }
    }
  });

  it("keeps every external label on the documentation domain", () => {
    for (const thread of Object.values(SEEDED_THREADS)) {
      for (const message of thread.messages) {
        if (!message.label) continue;
        const looksLikeDomain = message.label.includes(".");
        if (looksLikeDomain) expect(message.label).toContain("example.com");
      }
    }
  });
});
