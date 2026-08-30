/**
 * The fixture corpus.
 *
 * This file is the instrument that measures the engine, which is why the
 * adversarial review found every one of its measured failures here rather than
 * in the matcher: a weak corpus is a blindfold. Four properties are load-bearing
 * and each one traces to a confirmed finding.
 *
 * **Rows carry a recipient (F31).** Without it the requirement "tone rules fire
 * internally, the residency rule does not" cannot be stated as an assertion, and
 * the sweep would run rule-against-sentence with the context gate bypassed.
 *
 * **Rows carry a role (F3).** Measured, the seeded inbound question
 * `can you confirm our data stays inside the US?` scores 0.833 against R1 while
 * the demo's own must-flag paraphrase scores 0.512. A zero-false-positive gate
 * over both is unsatisfiable. But `scan(draft, recipient)` can never receive an
 * inbound message, so inbound rows never belonged under that gate. They stay
 * here as an informational would-have-flagged report.
 *
 * **Rows carry a split (F5).** The sweep reads `dev`; published precision and
 * recall read `holdout`, written before any threshold was chosen and never
 * inspected while tuning. Otherwise the site's most credible-looking artifact
 * would be a training score reported as an evaluation score.
 *
 * **The rows that must grow with the rule set are generated, not transcribed.**
 * Hand maintenance is what failed: `harsh-criticism`'s suggested wording escaped
 * the must-not-flag set entirely and measures 0.470 against its own exemplars,
 * so a visitor clicking `Use this` would get a fresh card on the replacement
 * text (F32). Call `allFixtures(rules)` rather than reading `FIXTURES` directly
 * and no new rule can ship without its replacement and its negation tested.
 */

import type { PolicyRule, RecipientKind } from "./types";

export type Fixture = {
  text: string;
  /** Rule id for a must-flag row, `null` for must-not-flag. */
  expect: string | null;
  /** Default `external-domain`, the context where every rule is active. */
  recipient?: RecipientKind;
  /** Default `draft`. Only `draft` rows are under the zero-false-positive gate. */
  role?: "draft" | "inbound";
  /** Default `dev`. Published numbers may only come from `holdout`. */
  split?: "dev" | "holdout";
  tags?: string[];
};

/* -------------------------------------------------------------------------- */
/* Mechanical transforms                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Lower-case the opening letter, except where doing so would produce a sentence
 * nobody types. `i do not think this approach will hold up` is a different string
 * from the one a person writes, and the embedding compares register as well as
 * meaning, so a mangled row would measure the mangling.
 */
function lowerFirst(text: string): string {
  const first = text.split(/\s+/)[0] ?? "";
  if (/^I(?![a-z])/.test(first) || /^[A-Z]{2,}/.test(first)) return text;
  return text.length === 0 ? text : text[0].toLowerCase() + text.slice(1);
}

function stripTerminal(text: string): string {
  return text.replace(/[.!?]+\s*$/, "");
}

/**
 * Auxiliaries that can be negated in place, with the form a person actually
 * types. Only the first auxiliary in the opening few tokens is rewritten:
 * negating one buried mid-sentence produces junk like "what they were not
 * doing", where the negator no longer governs the cue and the row would test
 * nothing.
 */
const AUXILIARIES: Array<[string, string]> = [
  ["cannot", "cannot"],
  ["can", "cannot"],
  ["could", "could not"],
  ["will", "will not"],
  ["would", "would not"],
  ["shall", "shall not"],
  ["should", "should not"],
  ["is", "is not"],
  ["are", "are not"],
  ["was", "was not"],
  ["were", "were not"],
  ["do", "do not"],
  ["does", "does not"],
  ["did", "did not"],
];

const SUBJECTS = new Set([
  "i",
  "we",
  "you",
  "he",
  "she",
  "it",
  "they",
  "that",
  "this",
  "there",
]);

/**
 * Turn an affirmative line into a refusal, mechanically.
 *
 * The transform matters more than its prose quality. F1 is the finding that
 * broke the original design: measured, `we cannot guarantee your data never
 * leaves the US` scores 0.978 against R1 while the affirmative promise scores
 * 0.964, so the refusal outscores the promise on every rule. Every cue must
 * survive the rewrite, because a variant that drops the cue exercises the cue
 * gate rather than the negator gate and would pass for the wrong reason.
 */
export function negate(text: string): string {
  const tokens = text.split(/\s+/);
  const head = tokens.slice(0, 5).map((t) => t.toLowerCase().replace(/[^a-z']/g, ""));

  // "let's continue this on my personal phone" -> "let's not continue ..."
  const letMatch = text.match(/^(let'?s|let me)\s+/i);
  if (letMatch) {
    return text.slice(0, letMatch[0].length) + "not " + text.slice(letMatch[0].length);
  }

  // A question opening with an auxiliary negates inside the clause, not in front
  // of it: "did you even read what I sent" -> "did you not even read what I sent".
  if (tokens.length > 2 && SUBJECTS.has(head[1] ?? "")) {
    const opener = AUXILIARIES.find(([aux]) => aux === head[0]);
    if (opener) {
      return [tokens[0], tokens[1], "not", ...tokens.slice(2)].join(" ");
    }
  }

  // Two cases go straight to the wrapper rather than through in-place negation.
  // A line that already carries a negator would come back as `there is not no
  // way anyone could ever access it`, and an existential opening (`here is how
  // the controls work`) negates the wrong word. Both produce a row that reads as
  // nothing a person would send, and the corpus would then be measuring itself.
  const alreadyNegated = /\b(not|n't|cannot|never|no|nothing|nobody|none)\b/i.test(
    head.join(" "),
  );
  const existential = head[0] === "here" || head[0] === "there";
  if (!alreadyNegated && !existential) {
    for (let i = 1; i < Math.min(tokens.length, 5); i++) {
      const bare = head[i] ?? "";
      const hit = AUXILIARIES.find(([aux]) => aux === bare);
      if (hit) {
        const replaced = [...tokens];
        replaced[i] = tokens[i].replace(new RegExp(hit[0], "i"), hit[1]);
        return replaced.join(" ");
      }
    }
  }

  // Nothing in the opening is negatable, so refuse the whole line. This is the
  // shape the review measured: "I would not say it is completely secure" 0.727.
  return "I would not say " + lowerFirst(text);
}

/**
 * Benign trailing clauses for the compound variants (T2.7.1g). Rotated by index
 * so the corpus is deterministic: a flaky dilution number reads as calibration.
 */
const BENIGN_TAILS = [
  "and I'll send over the SOC 2 report tomorrow along with the DPA",
  "and I will get the notes from yesterday's call over to you as well",
  "and Priya is picking up the migration plan in the meantime",
  "and the architecture diagram is attached if that is useful",
  "and let me know if anyone else should be on the thread",
];

/** Benign opening clauses, so the flagged clause is diluted from both sides. */
const BENIGN_LEADS = [
  "thanks for waiting on this one",
  "quick note before the call tomorrow",
  "good to speak earlier",
  "just catching up on the thread",
  "sorry for the slow reply",
];

/* -------------------------------------------------------------------------- */
/* Generated rows                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Every suggested wording, plus two edits of it, as must-not-flag rows.
 *
 * The predicate is **every rule with a non-empty `replacement`**, never a count.
 * "All six of them" is how R7's replacement escaped the corpus while eight rules
 * shipped (F32), and it measures 0.470 against its own exemplars: above genuine
 * positives, so the card would reappear on the text the card recommended.
 *
 * The two paraphrases are edit shapes rather than rewrites, because a rewrite
 * cannot be generated from arbitrary replacement text but the way people edit an
 * accepted suggestion can: they trim it to the first sentence and add a lead-in,
 * or they keep both sentences and reorder them. Accepting a suggestion and then
 * editing it is the common case, and the product must stay quiet through it.
 */
export function replacementFixtures(rules: PolicyRule[]): Fixture[] {
  const rows: Fixture[] = [];

  for (const rule of rules) {
    const replacement = rule.replacement?.trim();
    if (!replacement) continue;

    const sentences = replacement
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const first = sentences[0] ?? replacement;

    rows.push({
      text: replacement,
      expect: null,
      tags: ["replacement", rule.id],
    });

    rows.push({
      text: "To be honest, " + lowerFirst(first),
      expect: null,
      tags: ["replacement", "paraphrase", rule.id],
    });

    rows.push({
      text:
        sentences.length > 1
          ? [...sentences].reverse().join(" ")
          : stripTerminal(replacement) + ", and I can go into more detail if that helps.",
      expect: null,
      tags: ["replacement", "paraphrase", rule.id],
    });
  }

  return rows;
}

/**
 * A negated variant of every exemplar and every replacement.
 *
 * This is the regression harness for F1, so it is generated rather than curated:
 * a new rule must not be able to ship without its negation tested. The rows are
 * `draft`, so they sit under the zero-false-positive gate, which is the whole
 * point. A card telling someone they over-promised when they explicitly refused
 * to promise is the single most damaging output this product can produce.
 */
export function negatedFixtures(rules: PolicyRule[]): Fixture[] {
  const rows: Fixture[] = [];
  const seen = new Set<string>();

  const add = (source: string, rule: PolicyRule, kind: string) => {
    const text = negate(source);
    if (seen.has(text)) return;
    seen.add(text);
    rows.push({
      text,
      expect: null,
      // Tone and language rules apply internally too, so a negated tone
      // exemplar has to be silent in both contexts. The stricter context is the
      // one that activates every rule, so that is where the row is asserted.
      recipient: "external-domain",
      tags: ["negated", kind, rule.id],
    });
  };

  for (const rule of rules) {
    if (rule.match.kind === "semantic") {
      for (const exemplar of rule.match.exemplars) add(exemplar, rule, "exemplar");
    }
    const replacement = rule.replacement?.trim();
    if (replacement) add(replacement, rule, "replacement");
  }

  return rows;
}

/**
 * For every must-flag row, a compound variant and a variant with no terminal
 * punctuation (T2.7.1g).
 *
 * This is the regression harness for F2. Measured, the risky clause alone scores
 * 0.964 against R1 and the same clause inside one natural sentence scores 0.197,
 * because mean pooling averages the promise away across the other tokens. Without
 * clause-level segmentation the plan's own stated common case is undetectable, so
 * every positive needs a diluted twin.
 *
 * Punctuation is removed from the end only. Soft clause boundaries are
 * comma-anchored (T2.4.5b), so a variant stripped of commas as well would be
 * testing the 200-character length guard instead; the two hand rows tagged
 * `length-guard` cover that path deliberately.
 */
export function compoundVariants(rows: Fixture[]): Fixture[] {
  const out: Fixture[] = [];
  let i = 0;

  for (const row of rows) {
    if (row.expect === null) continue;
    if ((row.role ?? "draft") !== "draft") continue;
    if (row.tags?.includes("compound")) continue;

    const tail = BENIGN_TAILS[i % BENIGN_TAILS.length];
    const lead = BENIGN_LEADS[i % BENIGN_LEADS.length];
    i++;

    const base = stripTerminal(row.text);
    const shared = {
      expect: row.expect,
      recipient: row.recipient,
      split: row.split,
    };

    out.push({
      ...shared,
      text: `${base}, ${tail}.`,
      tags: [...(row.tags ?? []), "compound"],
    });

    // The flagged clause moves to second position here. Measured, a greeting
    // clause in front costs as much as a trailing one: 0.246 against R1 for a
    // sentence whose bare clause scores 0.964.
    out.push({
      ...shared,
      text: `${lead}, and ${lowerFirst(base)}`,
      tags: [...(row.tags ?? []), "compound", "no-terminal-punctuation"],
    });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Hand-authored must-flag rows                                                */
/* -------------------------------------------------------------------------- */

/**
 * Positives are written in the casual first person a person actually types,
 * because the embedding compares register as well as meaning, and every one of
 * them carries at least one of its rule's cues: the semantic rung is a
 * conjunction, so a positive with no cue can never fire however high it scores.
 * A row that fails for want of a cue looks like a threshold problem and gets
 * "fixed" by lowering one.
 */
const MUST_FLAG: Fixture[] = [
  // R1 residency-promise. The first row is `composer.ghostInsert` and the first
  // of the three example replies from ux-spec §4.
  {
    text: "Yes, we guarantee your data never leaves the US.",
    expect: "residency-promise",
    tags: ["demo", "example-reply", "ghost"],
  },
  // The promise half of the `never` pair (T2.1.6b.5). Its partner, where `never`
  // is the negator rather than part of the promise, is in MUST_NOT_FLAG. Both are
  // permanent rows: `never` is the one token whose role is positional.
  {
    text: "your data never leaves the US, that is how it works",
    expect: "residency-promise",
    tags: ["never-pair"],
  },
  {
    text: "I can promise your records always stay in your own region.",
    expect: "residency-promise",
  },
  {
    text: "we assure you nothing you send us ever goes outside the country",
    expect: "residency-promise",
  },
  // PLAN §3 Moment 2, verbatim, deliberately compound so it also proves clause
  // segmentation. Nothing else ties the demo's central gesture to the corpus, so
  // without this row it can stop flagging while every gate stays green.
  //
  // KNOWN RED, and deliberately so: `validateFixtures` reports this row as
  // carrying none of R1's cues, because the cue list has `stays inside` while the
  // sentence reads `physically stay inside`. The semantic rung is a conjunction,
  // so as things stand the demo's central sentence cannot fire at any threshold.
  // The fix is a cue in `policies.ts` (`stay inside`, or `stays inside` widened),
  // never an edit to this text: T2.7.1i requires it verbatim, and rewording it to
  // make the check pass is exactly the silent failure the row exists to prevent.
  {
    text:
      "our contract means your records physically stay inside the country, and I'll send the DPA over tomorrow",
    expect: "residency-promise",
    tags: ["demo-critical", "compound"],
  },

  // R2 absolute-security-claim
  {
    text: "honestly there is no way anyone outside your org could ever get at it",
    expect: "absolute-security-claim",
  },
  {
    text: "the platform is completely locked down, nothing can get out",
    expect: "absolute-security-claim",
  },
  {
    text: "it is impossible for anyone on our side to see what you store",
    expect: "absolute-security-claim",
  },

  // R3 performance-guarantee
  {
    text: "you will see at least ten times faster queries, guaranteed",
    expect: "performance-guarantee",
  },
  {
    text: "I can guarantee your nightly reporting job drops under a second",
    expect: "performance-guarantee",
  },
  {
    text: "this will definitely cut your compute bill in half",
    expect: "performance-guarantee",
  },

  // R4 delivery-date-commitment. The second row is the delivery-date example
  // reply from ux-spec §4, written with `will have` rather than `we'll have`
  // because the cue list contains no contractions.
  {
    text: "the connector will be ready by the end of the quarter",
    expect: "delivery-date-commitment",
  },
  {
    text: "we will have the audit export shipped before you renew, definitely",
    expect: "delivery-date-commitment",
    tags: ["example-reply"],
  },
  {
    text: "row-level security is coming in the next release, definitely",
    expect: "delivery-date-commitment",
  },

  // R5 pricing-commitment
  {
    text: "I can get you thirty percent off for the first year",
    expect: "pricing-commitment",
  },
  {
    text: "we will match whatever price you have been quoted elsewhere",
    expect: "pricing-commitment",
  },
  { text: "I will waive the onboarding fee for you", expect: "pricing-commitment" },

  // R6 moving-off-record
  {
    text: "just text me instead, it is easier that way",
    expect: "moving-off-record",
  },
  {
    text: "let's finish this on my personal phone tonight",
    expect: "moving-off-record",
  },
  {
    text: "we can keep this part off the record if that helps",
    expect: "moving-off-record",
  },

  // R7 harsh-criticism. None of these touches a labour-relations topic, which is
  // deliberate: the labour rows in MUST_NOT_FLAG are near-paraphrases of these,
  // and the pair is what proves the exclusion is doing work.
  {
    text: "this is a stupid way to build the dashboard and you knew that",
    expect: "harsh-criticism",
  },
  {
    text: "whoever wrote this migration plan clearly had no idea what they were doing",
    expect: "harsh-criticism",
  },
  { text: "did you even read what I sent, honestly", expect: "harsh-criticism" },
  // T2.7.1h, the must-flag half: a tone rule fires internally. This is the row
  // E10's acceptance criteria point at, and its partner two rows below in
  // MUST_NOT_FLAG is the residency demo sentence in the same context.
  {
    text: "this is a terrible piece of work and a waste of everyone's afternoon",
    expect: "harsh-criticism",
    recipient: "internal",
    tags: ["internal-gate"],
  },

  // R8 strong-language. Mild words only, per the content-safety constraint on the
  // rule itself; this file must not become the profanity corpus that file refuses
  // to be. These rows are coupled to the shipped default term list, so a row that
  // stops flagging may mean the list changed rather than the engine breaking.
  {
    // F8's row, and the reason dedupe is not "pattern beats semantic": the term
    // rule matches one low-severity word inside the span the high-severity rule
    // matched. If the only card here reads `Strong language`, the button says
    // `Send` instead of `Send anyway` and the residency promise is never shown.
    text: "Yes, we damn well guarantee your data never leaves the US.",
    expect: "residency-promise",
    tags: ["dedupe"],
  },
  { text: "this whole rollout has been a damn mess", expect: "strong-language" },
  {
    text: "what the hell were we thinking shipping it in that state",
    expect: "strong-language",
  },
  { text: "honestly the whole thing is a load of crap", expect: "strong-language" },

  // Two run-ons with no punctuation at all, which is what the 200-character
  // length guard exists for (T2.4.5b). Comma-anchored soft boundaries cannot help
  // here, so these two rows are the only coverage that path gets.
  {
    text:
      "thanks for the call earlier I checked with the team and we guarantee your data never leaves the US so you can put that straight into the security review and I will send the DPA across later today",
    expect: "residency-promise",
    tags: ["compound", "length-guard"],
  },
  {
    text:
      "quick one before I forget I can get you thirty percent off if you sign before the end of the quarter and I will get the paperwork moving on our side straight away so nothing holds you up",
    expect: "pricing-commitment",
    tags: ["compound", "length-guard"],
  },
];

/* -------------------------------------------------------------------------- */
/* Hand-authored must-not-flag rows                                            */
/* -------------------------------------------------------------------------- */

/**
 * The must-not side is deliberately larger, because it is the set that decides
 * the thresholds. Every innocuous row is drawn from the same topical
 * neighbourhood as a rule: `our security team can walk you through our residency
 * options` has to stay silent while `your data never leaves the US` fires, and
 * unrelated small talk would not have tested anything. Two of these rows were
 * measured against R1 at 0.795 and 0.833, above every unseen positive measured,
 * which is precisely why they are here rather than in a comment.
 */
const MUST_NOT_FLAG: Fixture[] = [
  // Residency and security neighbourhood.
  { text: "our security team can walk you through our residency options", expect: null },
  {
    text: "where your data is stored depends on the region you pick at setup",
    expect: null,
  },
  {
    text: "I can share the current SOC 2 report and the subprocessor list if that helps",
    expect: null,
  },
  {
    text:
      "the deployment region is configurable, so the honest answer is that it depends on what you choose",
    expect: null,
  },
  {
    text: "happy to get our security team on a call to go through the controls in detail",
    expect: null,
  },
  {
    text: "our documentation covers how encryption keys are handled and who can reach them",
    expect: null,
  },
  {
    text: "the audit log records every access, and you can export it yourself whenever",
    expect: null,
  },
  {
    text: "our contract terms cover where processing happens, and legal can talk you through them",
    expect: null,
  },
  // The negator half of the `never` pair (T2.1.6b.5). Here `never` governs the
  // cue instead of being part of the promise, and resolving that by position is
  // the whole job. Both halves are permanent rows.
  {
    text: "we never guarantee that, so let me find out what we can actually say",
    expect: null,
    tags: ["never-pair"],
  },
  // F1 itself, as a permanent row rather than a comment. This is the exact string
  // the review measured at 0.978 against R1, above the affirmative promise's
  // 0.964, and it is the sentence that broke the original design. `negate()`
  // cannot produce it: the exemplar carries `never` in its opening window, so the
  // generator correctly routes it to the `I would not say ...` wrapper instead of
  // inserting `cannot`. Leaving the row to the generator therefore left the single
  // highest-scoring false positive in the project untested.
  {
    text: "we cannot guarantee your data never leaves the US",
    expect: null,
    tags: ["negated", "f1", "residency-promise"],
  },

  // Performance, dates, and pricing neighbourhoods.
  { text: "performance depends a lot on the workload and the shape of the data", expect: null },
  {
    text:
      "in a comparable setup we saw a meaningful improvement, though your numbers may land differently",
    expect: null,
  },
  {
    text: "the roadmap item is in progress and I would rather not put a date on it yet",
    expect: null,
  },
  {
    text: "pricing is handled by our commercial team, and I will loop them in today",
    expect: null,
  },
  {
    text: "I will check internally on what discounting is possible and come back to you",
    expect: null,
  },
  {
    text: "the security review is with our team now and I will chase it tomorrow",
    expect: null,
  },
  { text: "your account manager can confirm what is in your current agreement", expect: null },

  // Recordkeeping neighbourhood, which is R6's topic without R6's move.
  {
    text: "keeping everything in this thread means nobody has to dig through their inbox later",
    expect: null,
  },
  {
    text: "I would rather keep this in writing so we both have a record of what we agreed",
    expect: null,
  },

  // T2.7.1h, the must-not-flag half, and Moment 1 itself: the same sentence as
  // the first must-flag row, in an internal conversation. `residency-promise`
  // stays external-only, and this row is what stops a later tidy-up from
  // "simplifying" that scoping away.
  {
    text: "Yes, we guarantee your data never leaves the US.",
    expect: null,
    recipient: "internal",
    tags: ["internal-gate", "demo"],
  },
];

/**
 * Ordinary disagreement, all must-not-flag.
 *
 * This is the set that decides whether `harsh-criticism` can ship at all.
 * Measured against its own exemplars, these score 0.34 to 0.47 while genuine
 * positives score 0.32 to 0.45: the distributions are inverted, and the highest
 * scorer of all is a paraphrase of the rule's own suggested wording (F4). Any
 * threshold low enough to catch real harshness flags the advice the product
 * gives. If that cannot be separated, the rule becomes a cue-pattern rule or an
 * honest roadmap miss. It does not ship as a dead entry in `/settings`, and no
 * threshold gets nudged to make this set look clean.
 */
const DISAGREEMENT: Fixture[] = [
  { text: "I don't think this is the right approach", expect: null, tags: ["disagreement"] },
  { text: "no, that is not what I asked for", expect: null, tags: ["disagreement"] },
  {
    text: "did you get a chance to read the doc I sent",
    expect: null,
    tags: ["disagreement"],
  },
  {
    text: "I disagree with the conclusion in the second section",
    expect: null,
    recipient: "internal",
    tags: ["disagreement"],
  },
  {
    text: "this does not match what we agreed last week",
    expect: null,
    recipient: "internal",
    tags: ["disagreement"],
  },
  {
    text: "I am not convinced the numbers in the summary add up",
    expect: null,
    recipient: "internal",
    tags: ["disagreement"],
  },
  {
    text: "that is not going to work for the timeline we have",
    expect: null,
    tags: ["disagreement"],
  },
  {
    text: "can we revisit this, I think we are solving the wrong problem",
    expect: null,
    recipient: "internal",
    tags: ["disagreement"],
  },
];

/**
 * Labour-relations rows, all internal, all must-not-flag, and a hard gate rather
 * than a target: zero `tone` and zero `language` findings at every threshold in
 * the sweep (D23, T2.1.7).
 *
 * The first two are deliberate near-paraphrases of `harsh-criticism`'s own
 * exemplars, which is the point. Measured, `whoever set this on-call schedule
 * clearly had no idea what it takes to do this job` clears any plausible
 * threshold, so shipping without the exclusion means the demo flags protected
 * concerted activity about workload and pay, on a page whose strongest section
 * cites Section 7 as the reason the product exists. Section 7 protects employees
 * discussing pay, hours, and working conditions with each other, and this product
 * must not be the thing that chills it.
 *
 * A commitment finding in a sentence that also mentions pay still flags: the
 * exclusion covers tone and language only, and the last row here is the paired
 * must-flag case that proves it.
 */
const LABOUR: Fixture[] = [
  {
    text:
      "whoever set this on-call schedule clearly had no idea what it takes to do this job",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "did you even read the pay band you sent me, honestly",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "this is a stupid way to run an on-call rotation and it is burning people out",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "we are badly understaffed and the workload has stopped being sustainable",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "I want to talk about my compensation before the next review cycle",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "a few of us are comparing notes on the salary bands for our level",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "the overtime hours this quarter have been completely unreasonable",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "who decided the shift rota, because it is not safe at this headcount",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "I am raising a grievance about how the layoff list was drawn up",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "we are organizing a meeting to talk about the schedule and the staffing levels",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "HR retaliated after I raised a safety concern about the night shift",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  {
    text: "I will not stay quiet about the unsafe staffing on the loading floor",
    expect: null,
    recipient: "internal",
    tags: ["labour"],
  },
  // The paired positive. A commitment is still a commitment in a sentence that
  // mentions headcount, and an exclusion that swallowed this row would be too
  // wide. It is tagged `labour-commitment` rather than `labour` on purpose, so a
  // gate written as "every labour row is silent" cannot accidentally include it.
  {
    text: "I can get you thirty percent off, whatever the headcount ends up being",
    expect: "pricing-commitment",
    tags: ["labour-commitment", "commitment-survives-exclusion"],
  },
];

/* -------------------------------------------------------------------------- */
/* The seeded threads, informational only                                      */
/* -------------------------------------------------------------------------- */

/**
 * The seeded messages from ux-spec §3, both threads, as `role: "inbound"`.
 *
 * These rows are informational and explicitly **not** under the zero-false-positive
 * gate (F3). Measured, Sam's question `can you confirm our data stays inside the
 * US?` scores 0.833 against R1 while the demo's own must-flag paraphrase scores
 * 0.512, so treating it as a false positive would demand a threshold above every
 * real positive and no swept value could ever pass. But `scan(draft, recipient)`
 * can only ever see the composer, so an inbound message never belonged in that
 * gate. They belong in the corpus as a would-have-flagged report, which is a
 * useful number and a misleading gate.
 *
 * They also earn their place a second way: if a future change routes thread
 * content through `scan()`, this is the row that says what happens next.
 */
const SEEDED: Fixture[] = [
  {
    text:
      "Thanks for the walkthrough yesterday. Security had one question before we sign: can you confirm our data stays inside the US?",
    expect: null,
    role: "inbound",
    tags: ["seeded", "thread-a"],
  },
  // The bare question, which is the string the review actually measured.
  {
    text: "can you confirm our data stays inside the US?",
    expect: null,
    role: "inbound",
    tags: ["seeded", "thread-a"],
  },
  {
    text: "Let me bring in the right person on that.",
    expect: null,
    role: "inbound",
    tags: ["seeded", "thread-a"],
  },
  {
    text: "No rush, but we do need it in writing before Thursday.",
    expect: null,
    role: "inbound",
    tags: ["seeded", "thread-a"],
  },
  {
    text: "I've pushed the revised migration plan, have a look when you get a chance.",
    expect: null,
    recipient: "internal",
    role: "inbound",
    tags: ["seeded", "thread-b"],
  },
  {
    text: "Also, do you have a view on the rollout order?",
    expect: null,
    recipient: "internal",
    role: "inbound",
    tags: ["seeded", "thread-b"],
  },
  // The third of the three example replies from ux-spec §4, and the one that
  // carries the most weight: a visitor who only ever sees the product fire has no
  // evidence it stays quiet, and staying quiet is most of the credibility. Its
  // two siblings are in MUST_FLAG, tagged `example-reply`.
  {
    text: "Let me bring in our security team so you get the exact answer on residency.",
    expect: null,
    tags: ["example-reply", "must-stay-quiet"],
  },
];

/* -------------------------------------------------------------------------- */
/* Holdout                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The holdout split. Read this only after thresholds are frozen.
 *
 * Written in one pass before any threshold existed, and none of these rows is a
 * paraphrase of a dev row, because a holdout that rhymes with the dev set is
 * still a training score. The sweep must never read them: with 25 must-flag rows
 * across eight rules choosing the thresholds *and* producing the published
 * numbers, the table on the most credible-looking page of the site would be its
 * least true artifact, roughly plus or minus thirty points at 95% (F5).
 *
 * Two to three positives per rule is a small `n` and the published interval has
 * to say so. `precision 1.00 (n=4, 95% CI 0.40-1.00)` is honest; a bare 1.00 is
 * not. If a rule ends up with fewer than two holdout positives, add rows here
 * rather than borrowing from dev.
 */
const HOLDOUT: Fixture[] = [
  // residency-promise
  {
    text: "we can assure you the data stays inside your own region for good",
    expect: "residency-promise",
    split: "holdout",
  },
  {
    text: "I guarantee nothing you upload is ever stored abroad",
    expect: "residency-promise",
    split: "holdout",
  },
  {
    text: "as far as storage goes it never leaves the country, full stop",
    expect: "residency-promise",
    split: "holdout",
  },
  // absolute-security-claim
  {
    text: "there is no way a support engineer could ever read your tables",
    expect: "absolute-security-claim",
    split: "holdout",
  },
  {
    text: "the whole environment is fully isolated so nothing can reach it",
    expect: "absolute-security-claim",
    split: "holdout",
  },
  // performance-guarantee
  {
    text: "you will see no less than a fivefold speedup on the same hardware",
    expect: "performance-guarantee",
    split: "holdout",
  },
  {
    text: "I can guarantee the nightly load finishes inside the maintenance window",
    expect: "performance-guarantee",
    split: "holdout",
  },
  // delivery-date-commitment
  {
    text: "the new billing screen will ship before your renewal date",
    expect: "delivery-date-commitment",
    split: "holdout",
  },
  {
    text: "that migration tool will be ready by the end of August",
    expect: "delivery-date-commitment",
    split: "holdout",
  },
  // pricing-commitment
  {
    text: "I can get you the enterprise tier at the team price",
    expect: "pricing-commitment",
    split: "holdout",
  },
  {
    text: "we will match the discount you had last year",
    expect: "pricing-commitment",
    split: "holdout",
  },
  // moving-off-record
  {
    text: "easier if you use my personal email for this one",
    expect: "moving-off-record",
    split: "holdout",
  },
  {
    text: "give me a ring on my cell and we can sort it out between us",
    expect: "moving-off-record",
    split: "holdout",
  },
  // harsh-criticism
  {
    text: "this design doc is terrible and whoever reviewed it was not paying attention",
    expect: "harsh-criticism",
    split: "holdout",
  },
  {
    text: "did you even look at the numbers before sending this out",
    expect: "harsh-criticism",
    recipient: "internal",
    split: "holdout",
  },
  // strong-language
  {
    text: "the build is broken again, damn it",
    expect: "strong-language",
    split: "holdout",
  },
  {
    text: "this is one hell of a mess to unpick",
    expect: "strong-language",
    recipient: "internal",
    split: "holdout",
  },

  // Out-of-sample negatives, same topical neighbourhoods.
  {
    text: "the region your data sits in is part of the deployment configuration",
    expect: null,
    split: "holdout",
  },
  {
    text: "I can ask our compliance lead to answer the residency question properly",
    expect: null,
    split: "holdout",
  },
  {
    text: "our security documentation is current as of last quarter and I can send it over",
    expect: null,
    split: "holdout",
  },
  {
    text: "the controls are described in the architecture overview, in section four",
    expect: null,
    split: "holdout",
  },
  {
    text: "throughput in your case will depend on how the tables are laid out",
    expect: null,
    split: "holdout",
  },
  {
    text: "we have seen good results on similar workloads, but I would want to measure yours",
    expect: null,
    split: "holdout",
  },
  {
    text: "the feature is on the roadmap and I do not have a date I can stand behind",
    expect: null,
    split: "holdout",
  },
  {
    text: "any discount would need approval, so let me find out and come back to you",
    expect: null,
    split: "holdout",
  },
  {
    text: "let's keep the thread here so the whole team can follow it",
    expect: null,
    split: "holdout",
  },
  {
    text: "I would rather not move this somewhere else, one record is easier for both of us",
    expect: null,
    split: "holdout",
  },
  {
    text: "the renewal paperwork is already with your account manager",
    expect: null,
    split: "holdout",
  },
  {
    text: "happy to set up a call if going through it live would be quicker",
    expect: null,
    split: "holdout",
  },
  {
    text: "the DPA is attached, along with the subprocessor list you asked about",
    expect: null,
    split: "holdout",
  },
  {
    text: "I am not able to promise a date, but I can tell you what is in progress",
    expect: null,
    split: "holdout",
  },
  {
    text: "I read it twice and I still do not follow the argument in part two",
    expect: null,
    recipient: "internal",
    split: "holdout",
    tags: ["disagreement"],
  },
  {
    text: "that is not the conclusion I would draw from the same data",
    expect: null,
    recipient: "internal",
    split: "holdout",
    tags: ["disagreement"],
  },
  {
    text: "the on-call rota has been brutal this month and we should talk about it",
    expect: null,
    recipient: "internal",
    split: "holdout",
    tags: ["labour"],
  },
  {
    text: "I want to understand how the bonus pool was split this year",
    expect: null,
    recipient: "internal",
    split: "holdout",
    tags: ["labour"],
  },
];

/* -------------------------------------------------------------------------- */
/* Assembly                                                                    */
/* -------------------------------------------------------------------------- */

/** The hand-authored corpus. Prefer `allFixtures(rules)`; see below. */
export const FIXTURES: Fixture[] = [
  ...MUST_FLAG,
  ...MUST_NOT_FLAG,
  ...DISAGREEMENT,
  ...LABOUR,
  ...SEEDED,
  ...HOLDOUT,
];

/**
 * The corpus the sweep should actually run: hand-authored rows, every rule's
 * suggested wording and two edits of it, a negation of every exemplar and every
 * replacement, and a diluted twin of every positive.
 *
 * This function exists so no caller can run a partial corpus. Every generated
 * family here closes a confirmed finding, and the way each of them failed was by
 * being someone's remembered responsibility rather than a call site.
 */
export function allFixtures(rules: PolicyRule[]): Fixture[] {
  return [
    ...FIXTURES,
    ...replacementFixtures(rules),
    ...negatedFixtures(rules),
    ...compoundVariants(FIXTURES),
  ];
}

/**
 * Fill in the three optional fields with their documented defaults.
 *
 * Every consumer needs these, and three consumers each defaulting `recipient` in
 * their own way is how a gate ends up measuring something other than what it
 * claims. One definition, imported.
 */
export function fixtureDefaults(fixture: Fixture): {
  recipient: RecipientKind;
  role: "draft" | "inbound";
  split: "dev" | "holdout";
} {
  return {
    recipient: fixture.recipient ?? "external-domain",
    role: fixture.role ?? "draft",
    split: fixture.split ?? "dev",
  };
}

/* -------------------------------------------------------------------------- */
/* Self-consistency                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Check the corpus against the rule set, before either is used to judge the
 * other. Returns a list of problems; empty means consistent.
 *
 * A corpus can be wrong in ways that look exactly like an engine bug, and each
 * check below is one of those disguises: a positive naming a rule that no longer
 * exists, a positive asserted in a context where its rule is scoped off, a rule
 * with too few positives to satisfy the recall floor, a duplicate row quietly
 * double-weighting one sentence in the published precision. Failing here names
 * the real cause instead of sending someone to tune a threshold.
 */
export function validateFixtures(
  rules: PolicyRule[],
  fixtures: Fixture[] = allFixtures(rules),
): string[] {
  const problems: string[] = [];
  const byId = new Map(rules.map((rule) => [rule.id, rule]));

  const seen = new Set<string>();
  const positivesPerRule = new Map<string, number>();
  // The size and balance checks count hand-authored rows only. Each generated
  // family is single-class by construction: negations and replacements are all
  // must-not-flag, diluted twins are all must-flag. Counting them would measure
  // how many rules exist rather than whether the corpus is designed to constrain
  // thresholds, and the balance requirement is about the latter.
  const generated = (fixture: Fixture) =>
    fixture.tags?.some((tag) => tag === "negated" || tag === "replacement" || tag === "compound") ??
    false;
  let mustFlagDrafts = 0;
  let mustNotFlagDrafts = 0;

  for (const fixture of fixtures) {
    const { recipient, role, split } = fixtureDefaults(fixture);
    const label = JSON.stringify(fixture.text.slice(0, 60));

    if (fixture.text.trim().length === 0) {
      problems.push(`empty fixture text (expect ${String(fixture.expect)})`);
      continue;
    }
    // Under the 15-character floor a row is skipped before any rule sees it, so
    // it measures nothing whichever side it is on.
    if (fixture.text.trim().length < 15) {
      problems.push(`${label} is under the 15-character segmentation floor`);
    }

    const key = `${fixture.text} ${recipient} ${role}`;
    if (seen.has(key)) {
      problems.push(`${label} is duplicated at recipient ${recipient}, role ${role}`);
    }
    seen.add(key);

    if (fixture.expect === null) {
      if (role === "draft" && !generated(fixture)) mustNotFlagDrafts++;
      continue;
    }

    const rule = byId.get(fixture.expect);
    if (!rule) {
      problems.push(`${label} expects unknown rule id ${JSON.stringify(fixture.expect)}`);
      continue;
    }
    if (!rule.enabled) {
      problems.push(`${label} expects ${rule.id}, which ships disabled`);
    }
    if (!rule.appliesTo.includes(recipient)) {
      problems.push(
        `${label} expects ${rule.id} at recipient ${recipient}, where the rule is scoped off`,
      );
    }
    // The semantic rung is a conjunction, so a positive carrying none of its
    // rule's cues cannot fire at any threshold. That failure looks exactly like a
    // tuning problem from the sweep's output, and the response it invites is
    // lowering a threshold, which is how the demo dies quietly. Err wide on cues:
    // a broad cue list costs nothing directly, because the cosine still has to be
    // met.
    const cues =
      rule.match.kind === "semantic" ? rule.match.cues : rule.match.terms;
    const haystack = fixture.text.normalize("NFC").toLowerCase();
    if (!cues.some((cue) => haystack.includes(cue.normalize("NFC").toLowerCase()))) {
      problems.push(
        `${label} expects ${rule.id} but carries none of its cues, so it can never fire; ` +
          `widen the cue list to the form this row uses rather than lowering a threshold`,
      );
    }

    if (role === "inbound") {
      problems.push(`${label} is inbound and cannot reach scan(), so it cannot be must-flag`);
    } else if (!fixture.tags?.includes("compound")) {
      mustFlagDrafts++;
      positivesPerRule.set(rule.id, (positivesPerRule.get(rule.id) ?? 0) + 1);
    }
    // The rule that decides which card survives is dedupe precedence, not the
    // corpus, so a positive may name only one rule and that rule has to be the
    // one the engine is required to show.
    if (split !== "dev" && split !== "holdout") {
      problems.push(`${label} has an unknown split ${JSON.stringify(split)}`);
    }
  }

  // T2.7.3b's recall floor is three of a rule's own must-flag rows, so a rule
  // with fewer than three can only fail the gate for a reason the corpus caused.
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const n = positivesPerRule.get(rule.id) ?? 0;
    if (n < 3) {
      problems.push(
        `${rule.id} has ${n} uncompounded must-flag rows; the recall floor needs at least 3`,
      );
    }
    const replacement = rule.replacement?.trim();
    if (replacement && !fixtures.some((f) => f.tags?.includes("replacement") && f.tags?.includes(rule.id))) {
      problems.push(`${rule.id} has a replacement with no must-not-flag row for it`);
    }
    if (
      rule.match.kind === "semantic" &&
      !fixtures.some((f) => f.tags?.includes("negated") && f.tags?.includes(rule.id))
    ) {
      problems.push(`${rule.id} has no negated rows; F1 is untested for it`);
    }
  }

  // The spec's numbered minimums, checked rather than remembered. Each of these
  // sets was mandated because a measured finding needed it, and nothing else in
  // this file would notice if a later edit thinned one out: a corpus with two
  // labour rows left still returns "zero tone findings on every labour row" and
  // reads as a passing gate.
  const tagged = (tag: string, predicate: (f: Fixture) => boolean = () => true) =>
    fixtures.filter((f) => f.tags?.includes(tag) && predicate(f)).length;

  const labour = tagged(
    "labour",
    (f) => f.expect === null && fixtureDefaults(f).recipient === "internal",
  );
  if (labour < 10) {
    problems.push(`only ${labour} internal must-not-flag labour rows, T2.7.1e needs 10`);
  }
  const disagreement = tagged("disagreement", (f) => f.expect === null);
  if (disagreement < 8) {
    problems.push(`only ${disagreement} must-not-flag disagreement rows, T2.7.1f needs 8`);
  }
  // T2.7.1i: the demo's central sentence, and T2.1.6b.5's `never` pair, where the
  // point is that both halves exist. One half alone measures nothing, since the
  // whole question is whether position decides the token's role.
  if (tagged("demo-critical", (f) => f.expect !== null) === 0) {
    problems.push("no must-flag demo-critical row; PLAN §3 Moment 2 is untied to the corpus");
  }
  if (
    tagged("never-pair", (f) => f.expect !== null) === 0 ||
    tagged("never-pair", (f) => f.expect === null) === 0
  ) {
    problems.push("the `never` pair needs both halves: one must-flag and one must-not-flag");
  }
  // ux-spec §4's three example replies, two of which flag and one of which must
  // not. The quiet one is the row a visitor's trust actually rests on, and it is
  // the easiest of the three to lose in a tidy-up.
  if (tagged("example-reply", (f) => f.expect === null) === 0) {
    problems.push("ux-spec §4's deliberately fine example reply is missing");
  }
  if (tagged("example-reply", (f) => f.expect !== null) < 2) {
    problems.push("ux-spec §4's two flagging example replies are not both present");
  }
  // F3: the seeded thread rows are informational, so their value is entirely in
  // existing. Nothing downstream fails if they vanish.
  const seeded = tagged("seeded", (f) => fixtureDefaults(f).role === "inbound");
  if (seeded < 5) {
    problems.push(`only ${seeded} inbound seeded rows, ux-spec §3 seeds 5 messages`);
  }

  if (mustFlagDrafts < 25) problems.push(`only ${mustFlagDrafts} must-flag draft rows, need 25`);
  if (mustNotFlagDrafts < 25) {
    problems.push(`only ${mustNotFlagDrafts} must-not-flag draft rows, need 25`);
  }
  // The must-not side is what constrains the thresholds, so it is meant to be the
  // larger half. If it ever is not, the corpus has drifted toward measuring
  // recall, which is the cheaper number to make look good.
  if (mustNotFlagDrafts <= mustFlagDrafts) {
    problems.push(
      `corpus is weighted toward must-flag (${mustFlagDrafts} vs ${mustNotFlagDrafts})`,
    );
  }

  return problems;
}
