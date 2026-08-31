# Second Thought

A pre-send draft check that runs entirely in your browser. Your company has rules about what you can
promise, what you can share, and how you talk to people. When you are busy and someone is waiting,
they are easy to cross without noticing. Second Thought reads your draft on your own computer, points
out the line that could cause trouble, and offers a safer way to say it.

Live at [secondthought.work](https://secondthought.work).

Nothing you type is sent anywhere. The check runs on your own machine, so there is no server that
could receive a draft.

## What it does not do

This section is first on purpose. The limits are the honest part, and a tool about careful wording
should not itself overclaim.

- **It does not stop you sending anything.** It is advisory. Every note can be dismissed, and
  sending is always available. This tool works for you, not on you.
- **Its accuracy has not been measured.** Every similarity bar in `app/lib/policies.ts` is a
  placeholder. No false-positive rate and no recall figure exists yet, so none is published. Treat
  the scores it shows as rough.
- **Eight rules, and they are a demonstration.** They cover what you can promise about security and
  data residency, delivery dates, pricing, moving a conversation somewhere unrecorded, personal
  criticism, and strong language. They are invented for demonstration, not drawn from any employer's
  material.
- **English only.** The term lists and negation handling assume English word order.
- **One surface.** This site is a demo harness. The intended form is a browser extension for the
  tools teams already use, which is not built here.
- **It notices phrasing, not intent.** A claim written as a negation can slip past the cue gate.
  That tradeoff is deliberate and is described under "Known failure" below.
- **No console, no telemetry, no per-person reporting**, and that is a design constraint rather than
  a missing feature. The person typing is the primary beneficiary. See "Why it runs on your machine".

## Trying it

Type into the draft field, or click one of the example replies. The one that stays silent matters as
much as the ones that fire: it contains no cue of any rule, so the quiet is structural.

Switch the recipient between the internal thread and the external one with the same sentence in
place. Most rules are scoped to messages leaving the company, so the same words produce a note in one
thread and nothing in the other. Who you are writing to decides which rules apply.

To see that nothing is being sent, open your browser's network panel, let the page finish loading,
then turn the network off and keep typing. The checks keep working.

## How it works

A scan runs in stages, cheapest first, and stops as soon as it has an answer.

1. **A context gate** decides which rules apply to this recipient. Most rules do not apply to
   internal messages, so most of the work never happens.
2. **A deterministic stage** runs patterns and term lists over the draft. It needs nothing
   downloaded, so the page is useful in its first second.
3. **A meaning-based stage** compares each clause against the example phrasings a rule carries. This
   catches rewordings that share no distinctive words with any example.

A rule in the third stage fires only when three things hold: a cue phrase is present, no negation
governs that cue, and the clause clears that rule's similarity bar. All three are required, and the
conjunction is the interesting part.

### Known failure

Similarity alone does not work here. `we cannot guarantee your data never leaves the US` scores
**0.978** against the data-residency examples while the actual promise, `Yes, we guarantee your data
never leaves the US`, scores **0.964**. The careful sentence scores higher than the reckless one,
because the encoder represents topic and vocabulary more strongly than stance. A bare threshold would
put a note under the most careful sentence in the draft.

The cue-and-negator conjunction fixes that case and introduces its own: a claim expressed as a
negation of a negative can pass the gate unnoticed. Both failures were measured, and this is the
cheaper one.

## Why it runs on your machine

This is a constraint the design started from rather than a feature added later. The reasoning is
about why this product is built this way. None of it is a claim about anyone else's software, and
none of it is legal advice.

Section 7 of the NLRA protects most private-sector employees discussing pay and working conditions.
Regulators have pressed for heightened scrutiny of monitoring technology on that basis. The specific
NLRB General Counsel guidance from 2022 was rescinded in February 2025, and enforcement posture here
moves with each administration, which is exactly why the architecture should not depend on it.

In Germany, §87(1)(6) BetrVG gives a works council, where one exists, co-determination over technical
devices suitable for monitoring behaviour or performance. German case law reads capability rather
than intent as the trigger.

Under EU and UK data-protection law, monitoring employee messages is processing supervisory
authorities treat as likely high risk, so a data protection impact assessment is normally required,
and employee consent is weak basis because of the power imbalance in employment relationships.

So the design conclusion: nothing you type leaves the device, there is no console showing anyone else
what you wrote, there is no per-person reporting, and the rule set deliberately does not look at pay,
hours, working conditions, or organising. A tool with no content leaving the machine and no manager
dashboard is the one that survives that review, and it is the one people will actually leave switched
on.

## Running it locally

Node 22 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
```

The prebuild step vendors the runtime and the model weights into `public/` and bundles the worker.
Those directories are generated and are not tracked.

```bash
npm run build         # static export into ./out
npm test              # unit and behaviour tests
npx tsc --noEmit      # types
```

## Layout

```
app/lib/          the engine: policies, segmentation, negation, the scan ladder, the worker
app/components/   the composer, the thread, the finding cards
app/press/        the press page
app/settings/     the rules, and what the check deliberately ignores
scripts/          vendoring the runtime and weights, bundling the worker, measuring the encoder
```

`app/lib/policies.ts` is the interesting file. Everything else is plumbing around it.

## A note on the rules

The eight rules cover what you can promise about security and data residency, delivery dates, pricing
and discounts, moving a conversation somewhere unrecorded, personal criticism, and strong language.
They are invented for demonstration. None of them is drawn from any employer's material, and none
names a company, product, or person.

The rule set deliberately does not look at pay, hours, working conditions, or organising activity.
That exclusion is enforced in code, not by convention.

---

Second Thought is a drafting aid. It does not provide legal or compliance advice and does not ensure
compliance with any law, regulation, or company policy.
