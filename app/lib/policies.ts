/**
 * The company rule set. Rules are data, never code.
 *
 * `docs/ux-spec.md` section 13 is the single source of truth for every string in
 * this file: ids, titles, severities, `why` text, exemplars, suggested wording,
 * and cues. Everything here is transcribed from it rather than composed here, so
 * that the two can never disagree. If a rule needs to change, change it there
 * first and then transcribe again.
 *
 * Three properties of this file are load-bearing and easy to undo by accident.
 *
 * **`cues` is not a keyword fallback and it is not optional.** A semantic rule
 * fires only when a cue is present, no negator governs that cue, and cosine
 * clears the threshold. Measured on the shipped model, the refusal
 * `we cannot guarantee your data never leaves the US` scores 0.978 against the
 * residency exemplars while the risky `we guarantee your data never leaves the
 * US` scores 0.964. The refusal outscores the promise on every rule, because
 * mean-pooled embeddings encode topic and vocabulary rather than stance, so no
 * threshold can separate them. Deleting a cue list does not loosen a rule, it
 * turns that rule into one that flags the careful writer at maximum confidence.
 *
 * **Scoping is per rule, not a master switch.** The six external rules keep
 * `appliesTo` without `internal`, which is what makes the recipient switch mean
 * something; tone and language apply inside the company as well. Tidying either
 * side of that erases the product's central idea.
 *
 * **No rule, title, why, exemplar, or replacement names a real company, product,
 * messaging app, or person**, per `content-safety.md` section 6. Exemplars are
 * plainly invented generic B2B wording. They also stay in the casual first
 * person a person actually types, because the embedding compares register as
 * well as meaning and an exemplar phrased like a policy document will not match
 * a real draft.
 */

import type { PolicyRule } from "@/app/lib/types";

/**
 * A placeholder, and the honest thing to do until T2.7 runs.
 *
 * Every semantic rule carries this same value because no threshold has been
 * calibrated yet. T2.7's sweep over the fixture corpus replaces these with
 * per-rule numbers chosen for precision over recall, and records them with their
 * measured false-positive and recall figures in `docs/build-log.md`. A varied
 * set of hand-picked numbers here would look tuned while being guesswork, which
 * is worse than one obviously provisional constant.
 *
 * Do not raise a threshold to make a gate green. That is how the demo's central
 * sentence stops flagging with every check still passing.
 */
export const PLACEHOLDER_THRESHOLD = 0.6;

/**
 * Categories follow one distinction, so that the derived `panel.internal` line
 * reads sensibly: `claim` is an assertion about how the product behaves,
 * `commitment` is a promise about something we will do, `channel` is about where
 * the conversation happens. `disclosure` belongs to the deterministic rung's
 * secrets and personal-data findings rather than to any rule here.
 */
export const COMPANY_RULES: PolicyRule[] = [
  {
    id: "residency-promise",
    source: "company",
    enabled: true,
    title: "An unconditional promise about where data is stored",
    category: "claim",
    severity: "high",
    appliesTo: ["external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "guarantee",
        "guaranteed",
        "'ll guarantee",
        "never leaves",
        "always stays",
        "stays inside",
        // PLAN section 3's Moment 2 reads "physically stay inside". One letter
        // apart from "stays inside", and without it the demo-critical fixture
        // carries no cue and cannot fire at any threshold.
        "stay inside",
        // Exemplar 3 ("nothing you send us ever goes outside the country")
        // contained no cue of its own rule and was therefore dead weight.
        "goes outside",
        "outside the country",
        "promise",
        "assure",
      ],
      exemplars: [
        "we guarantee your data never leaves the US",
        "your data stays inside your own region, always",
        "nothing you send us ever goes outside the country",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why:
      "Where data lives depends on how the deployment is configured and what the contract says. " +
      "An unconditional promise can commit your company to more than it has agreed to.",
    replacement:
      "Our data-residency options depend on your deployment and contract terms. I can put you in touch with our security team for the specifics.",
  },
  {
    id: "absolute-security-claim",
    source: "company",
    enabled: true,
    title: "An absolute claim about security",
    category: "claim",
    severity: "high",
    appliesTo: ["external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "completely",
        "totally",
        "fully",
        "no way",
        "impossible",
        "nothing can",
        "inaccessible",
        "not even we",
        // "never" and "cannot be" were cues here, but a cue that is itself a
        // whole negator is suppressed unconditionally by the negation gate, so
        // both were dead.
        //
        // Deliberately NOT cued: the negative-form phrasing "we can't see your
        // data". It is a common and genuinely risky absolute claim, but the
        // negation gate cannot tell it apart from a refusal. A refusal negates a
        // commitment verb ("we cannot guarantee"); this negates a capability
        // verb ("we cannot see"), and the surface grammar is identical. Cueing
        // it would mean weakening the negation gate, which reintroduces the
        // worse failure: flagging someone who explicitly declined to promise.
        // Recorded as a known recall gap for T2.7 rather than papered over.
      ],
      exemplars: [
        "it is completely secure, nothing can leak",
        "there is no way anyone could ever access it",
        // Was "we can't see your data at all, ever". Replaced with an
        // affirmative phrasing of the same claim; see the cue note above.
        "your data is completely inaccessible, not even we can read it",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why:
      "Absolute statements about security are difficult to support and tend to outlive the " +
      "configuration they described.",
    replacement:
      "Here is how the controls actually work, and I can share our current security documentation so you can review the specifics.",
  },
  {
    id: "performance-guarantee",
    source: "company",
    enabled: true,
    title: "A performance number stated as a guarantee",
    category: "claim",
    severity: "medium",
    appliesTo: ["external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "guarantee",
        "guaranteed",
        "definitely",
        "will see",
        "'ll see",
        "at least",
        "no less than",
        "cut in half",
      ],
      exemplars: [
        "you will definitely see ten times faster queries",
        "guaranteed under a millisecond every time",
        "it will cut your costs in half, guaranteed",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why:
      "Performance depends on workload, data shape, and configuration, so a guaranteed figure " +
      "can become a commitment nobody validated.",
    replacement:
      "In comparable setups we have seen meaningful improvement, and the honest answer depends on your workload. Happy to run a test with your data.",
  },
  {
    id: "delivery-date-commitment",
    source: "company",
    enabled: true,
    title: "A delivery date offered as a commitment",
    category: "commitment",
    severity: "medium",
    appliesTo: ["external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "will be ready",
        "will ship",
        "will have",
        // People type contractions in chat. Without these, R4 misses
        // "we'll have it ready" entirely.
        "'ll be ready",
        "'ll ship",
        "'ll have",
        "'ll get",
        "by the end of",
        "before you",
        "next release",
        "definitely",
      ],
      exemplars: [
        "that will be ready by the end of next month",
        "we will have that shipped before you renew",
        "it is coming in the next release, definitely",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why: "Dates shared outside the company tend to be heard as commitments, whoever said them.",
    replacement:
      "That is something we are actively working on. I would rather not put a date on it until I can confirm one, and I will come back to you when I can.",
  },
  {
    id: "pricing-commitment",
    source: "company",
    enabled: true,
    title: "A price or discount offered without approval",
    category: "commitment",
    severity: "medium",
    appliesTo: ["external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "I can get you",
        "we will match",
        "we'll match",
        "I will waive",
        "I'll waive",
        "percent off",
        "% off",
        "discount",
        "free of charge",
      ],
      exemplars: [
        "I can get you thirty percent off",
        "we will match whatever price you have been quoted",
        "I will waive that fee for you",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why:
      "Pricing and discounting usually need approval, and an offer in writing is hard to walk " +
      "back.",
    replacement:
      "Let me check what we can do on pricing and come back to you with something firm.",
  },
  {
    id: "moving-off-record",
    source: "company",
    enabled: true,
    title: "Moving the conversation somewhere it is not recorded",
    category: "channel",
    severity: "high",
    appliesTo: ["external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "personal phone",
        "my cell",
        "text me",
        "off the record",
        "outside of here",
        "personal email",
      ],
      exemplars: [
        "let's continue this on my personal phone",
        "text me instead, easier that way",
        "we can keep this part off the record",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why:
      "Business conversations are usually expected to stay on systems the company keeps records " +
      "on, and moving them elsewhere can create a records problem for both sides.",
    replacement:
      "Happy to keep going here so everything stays in one place, or we can set up a call if that is easier.",
  },
  /**
   * This rule may not survive calibration, and that is a planned outcome.
   * Measured against its own exemplars, `I don't think this is the right
   * approach` scores 0.470, which is a paraphrase of this rule's own suggested
   * wording, while the genuine positive `this is a terrible piece of work`
   * scores only 0.322. The distributions are inverted, so any threshold low
   * enough to catch real harshness also flags the advice the product gives. It
   * ships only if it clears both of T2.7.3b's gates; otherwise it becomes a
   * cue-pattern rule in the deterministic rung or an honest roadmap miss. It
   * must not ship as a dead entry in the settings list.
   *
   * It is also labour-exclusion gated: see `labour-exclusion.ts`. That gate is
   * applied once in the effective-rule filter rather than here, so a personal
   * tone rule added later inherits it and cannot opt out.
   */
  {
    id: "harsh-criticism",
    source: "company",
    enabled: true,
    title: "This reads as criticism of a person rather than the work",
    category: "tone",
    severity: "medium",
    appliesTo: ["internal", "external-guest", "external-domain"],
    match: {
      kind: "semantic",
      cues: [
        "stupid",
        "no idea",
        "clearly did not",
        "clearly had no",
        "did you even",
        "terrible",
        "incompetent",
        "waste of",
      ],
      exemplars: [
        "this is a stupid way to do it",
        "whoever wrote this clearly had no idea what they were doing",
        "did you even read what I sent, honestly",
      ],
      threshold: PLACEHOLDER_THRESHOLD,
    },
    why:
      "Aimed at a person rather than at the work, this is likely to land harder than intended " +
      "and is harder to walk back in writing than in conversation.",
    replacement:
      "I do not think this approach will hold up, and here is the specific part I am worried about.",
  },
  /**
   * Mild words only, and this list stays short on purpose.
   *
   * A public repository containing a file of slurs is a liability and an
   * embarrassment regardless of intent, and this is not a slur detector. So: no
   * slurs, and no comprehensive profanity corpus, per `content-safety.md`
   * section 6. Anything stronger than what is here is the user's own addition,
   * in their own browser, and never in the repo. Do not expand this list to
   * improve coverage; coverage is not the point of this rule.
   *
   * The card offers `Remove it` instead of suggested wording, which is why this
   * is the one rule with no `replacement`: there is no single sensible rewrite
   * of a word someone chose deliberately.
   *
   * Terms match as literal substrings and are never compiled as patterns, so a
   * user-authored term containing regex metacharacters cannot throw inside a
   * scan. That algorithm lives in the deterministic rung.
   */
  {
    id: "strong-language",
    source: "company",
    enabled: true,
    title: "Strong language",
    category: "language",
    severity: "low",
    appliesTo: ["internal", "external-guest", "external-domain"],
    match: {
      kind: "terms",
      terms: [
        "damn",
        "damned",
        "hell",
        "crap",
        "crappy",
        "sucks",
        "screwed up",
        "pissed off",
        "bloody",
        "freaking",
        "frigging",
      ],
      wholeWord: true,
    },
    why:
      "Fine in some rooms and not in others, and this thread may be read by people who are not " +
      "in the room.",
  },
];
