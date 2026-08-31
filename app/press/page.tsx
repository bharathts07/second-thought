/**
 * `/press`: the release and the roadmap.
 *
 * A static server component. No client boundary, no state, no interactivity, so
 * nothing here ships JavaScript beyond what the framework already needs, which
 * is the right shape for a page whose central claim is that the site is a set of
 * static files.
 *
 * What governs the wording, since the temptation on a page like this is always to
 * make it stronger than the evidence:
 *
 *   - **No other company or product is named**, as comparison or otherwise
 *     (`content-safety.md` §3). The category is described neutrally instead. That
 *     is not timidity; the positive claim needs no comparison to stand up.
 *   - **The enforcement figure is aggregate and attributed to a period** (§4),
 *     and no fined company is named.
 *   - **The legal paragraph in §5 states guidance with its date and its current
 *     status**, attributes the works-council trigger to case law rather than to
 *     the statute, and frames the DPIA point as supervisory-authority posture
 *     rather than as a categorical requirement. A product about not overstating
 *     things in writing cannot overstate the law on its own press page, and this
 *     is the one section on the page that must not be shortened into confidence
 *     it has not earned.
 *   - **The ceiling is stated before any capability** (§5 of content-safety):
 *     advisory, bypassable, one surface, English only, and a demonstration rule
 *     set rather than a compliance programme.
 *   - **No precision figures.** Every rule threshold in `policies.ts` is still
 *     `PLACEHOLDER_THRESHOLD` and nothing has been measured out of sample, so the
 *     table prints the copy deck's `rule.notEvaluated` rather than a number that
 *     would be the most credible-looking and least true thing on the site.
 *
 * The rules table reads `COMPANY_RULES` directly rather than restating it, so the
 * published table cannot drift from the rule set the engine actually runs.
 */

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { COMPANY_RULES } from "@/app/lib/policies";
import type { PolicyRule } from "@/app/lib/types";
import { SeverityChip } from "@/app/components/SeverityChip";
import {
  Prose,
  ProseCallout,
  ProseEyebrow,
  ProseFigure,
  ProseFigureNote,
  ProseLead,
  ProseList,
  ProseListItem,
  ProseP,
  ProseSection,
  ProseSubheading,
  ProseTitle,
} from "@/app/components/Prose";

/** The third required part of the site, and therefore permanent furniture. */
const GITHUB_URL = "https://github.com/bharathts07/second-thought";

/** Strings owned by the copy deck (ux-spec §14), quoted rather than paraphrased. */
const COPY = {
  title: "Second Thought",
  subtitle:
    "A draft check that runs in your browser. Nothing you type is sent anywhere.",
  notEvaluated: "Not evaluated",
  disclaimer:
    "Second Thought is a drafting aid. It does not provide legal or compliance advice and " +
    "does not ensure compliance with any law, regulation, or company policy.",
} as const;

export const metadata: Metadata = {
  title: "Second Thought · Press",
  description: COPY.subtitle,
};

/** An inline link inside prose. Underlined, so it is never colour alone. */
function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="underline">
      {children}
    </Link>
  );
}

/**
 * Which conversations a rule applies in, derived from `appliesTo` rather than
 * written out, so a scoping change in `policies.ts` shows up here. The two
 * external kinds collapse into one word: the distinction between a guest and a
 * whole domain matters to the engine and not to a reader.
 */
function scopeLabel(rule: PolicyRule): string {
  const internal = rule.appliesTo.includes("internal");
  const external = rule.appliesTo.some((kind) => kind !== "internal");
  if (internal && external) return "Internal and external";
  if (external) return "External only";
  return "Internal only";
}

const CELL = "border-b border-hairline py-3 pr-4 align-top";
const COLUMN_HEAD =
  "border-b border-edge py-2 pr-4 text-2xs font-medium tracking-label text-ink-muted uppercase";

/**
 * The eight rules, as a genuine data table (T3.5.2) rather than bullets pretending
 * to be data.
 *
 * The precision column is deliberately full of the same words. A visitor who just
 * got a card will look for this table, and `Not evaluated` eight times is the
 * honest state of the rule set today: the thresholds are placeholders and nothing
 * has been scored against a held-out sample. A number here would be in-sample and
 * flattering, which is worse than a blank admission.
 *
 * The wrapper scrolls horizontally on a narrow screen and is focusable with a
 * label, because a scroll region a keyboard user cannot reach is a table they
 * cannot read.
 */
function RulesTable() {
  return (
    <div
      role="region"
      aria-label="The eight rules in this rule set"
      tabIndex={0}
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <table className="w-full min-w-reading border-collapse text-left text-sm">
        <caption className="sr-only">
          Each rule with its severity, the conversations it applies in, and its
          published precision.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={COLUMN_HEAD}>
              Rule
            </th>
            <th scope="col" className={COLUMN_HEAD}>
              Severity
            </th>
            <th scope="col" className={COLUMN_HEAD}>
              Applies in
            </th>
            <th scope="col" className={COLUMN_HEAD}>
              Precision
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPANY_RULES.map((rule) => (
            <tr key={rule.id}>
              <th scope="row" className={`${CELL} font-medium text-ink`}>
                {rule.title}
                {/* The id is the same string the card's provenance line shows, so
                    a visitor can match a card they saw to a row here. */}
                <span className="mt-1 block font-mono text-2xs font-regular text-ink-muted">
                  {rule.id}
                </span>
              </th>
              <td className={CELL}>
                <SeverityChip severity={rule.severity} />
              </td>
              <td className={`${CELL} text-ink-secondary`}>{scopeLabel(rule)}</td>
              <td className={`${CELL} font-mono text-2xs tabular-nums text-ink-muted`}>
                {COPY.notEvaluated}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PressHeader() {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex w-full max-w-app items-baseline justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-ink">
          {COPY.title}
        </Link>
        <nav aria-label="Site" className="flex items-baseline gap-5 text-sm">
          <Link href="/" className="hover:underline">
            The product
          </Link>
          <a href={GITHUB_URL} rel="noreferrer" className="hover:underline">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}

export default function PressPage() {
  return (
    <div className="min-h-screen">
      <PressHeader />

      <main className="mx-auto w-full max-w-app px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
        <Prose>
          <div className="flex flex-col gap-4">
            <ProseEyebrow>Press release</ProseEyebrow>
            <ProseTitle>
              Stay inside your company&rsquo;s rules, before you hit send.
            </ProseTitle>
            <ProseLead>
              Your company has rules about what you can promise, what you can share,
              and how you talk to people. When you are busy and someone is waiting,
              they are easy to cross without noticing. Second Thought reads your draft
              on your own computer, points out the line that could cause trouble, and
              offers a safer way to say it.
            </ProseLead>
          </div>

          {/* The ceiling before any capability claim (`content-safety.md` §5).
              Putting it here rather than in a footnote is the whole argument of
              the product applied to the product's own marketing. */}
          <div className="mt-8">
            <ProseCallout>
              <p className="font-ui text-sm">
                What it does not do, first. It advises and never stops a send. It
                is bypassable, by design and in one click. It runs on one surface,
                it works in English only, and its eight rules are a demonstration
                of the idea rather than a compliance programme.
              </p>
            </ProseCallout>
          </div>

          {/* Clear, unmissable way back to the working product. A reader who
              arrives here first and is convinced must not hunt for it. */}
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-edge bg-surface px-6 py-3 font-ui text-sm font-medium text-ink transition-colors hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Try it in this browser
              <span aria-hidden="true" className="text-ink-secondary">→</span>
            </Link>
          </div>

          <ProseSection index="01" id="the-gap" title="The gap is not the rule, it&rsquo;s the moment" spaceAbove="default">
            <ProseP>
              Your company has rules about what you can promise, what data you can
              share, how to talk about delivery dates and pricing. A compliance officer
              somewhere has written the exact wording you should use when a customer
              asks whether their data stays in one region. That wording is in a policy
              PDF or an internal wiki. The person typing the reply has four minutes
              before their next meeting. They are not going to open a policy document
              and search for the relevant section.
            </ProseP>
            <ProseP>
              Nobody sets out to break the rule. Someone is answering a customer who is
              waiting, and they type one sentence more confident than the company can
              stand behind. That sentence becomes evidence when the relationship breaks
              down. Regulators have issued fines totalling over $3B since 2021 over how
              business communications were kept and supervised, and most of what sits
              behind that figure was not anyone being dishonest. The gap is not that the
              rule does not exist. The gap is that it exists in the wrong place.
            </ProseP>
          </ProseSection>

          <ProseSection
            index="02"
            id="the-moment"
            title="Put the rule where you are typing"
            spaceAbove="large"
          >
            <ProseP>
              The useful moment is before the message leaves. Second Thought sits under
              the composer and says nothing until a sentence is worth reconsidering. When
              one is, a card appears with the rule in plain language, the reason that
              phrasing is risky, and suggested wording you can take with one click or
              leave alone. Nothing is held back from sending.
            </ProseP>
            <ProseP>
              The checking happens on your own machine. There is no version of this where
              someone reads your drafts. That is not a promise to trust; it is a property
              of how it is built. The checks run inside your browser. There is no server
              that could receive what you type.
            </ProseP>
            <ProseP>
              The gesture that explains it takes two seconds: switch the recipient from
              your own team to a customer, leave the draft as it is, and watch what it
              flags change. <TextLink href="/">Try it in this browser</TextLink>.
            </ProseP>
          </ProseSection>

          <ProseSection index="03" id="how-it-works" title="How it works" spaceAbove="extra">
            <ProseP>
              The checker runs inside your browser tab. The first time you visit, it
              downloads once and stays in your browser cache. After that, every check
              happens on your own device with nothing sent anywhere.
            </ProseP>
            <ProseP>
              A scan runs in stages, cheapest first. A context gate decides which rules
              apply to this recipient. A deterministic stage runs patterns and literal
              terms over the raw draft; it needs no external service, so the page is
              already working in its first second while the rest downloads.
            </ProseP>
            <ProseP>
              The meaning-based stage runs only when a cue phrase is present, no negation
              governs that cue, and the sentence clears that rule&rsquo;s similarity bar
              against its examples. All three conditions are needed. The checker encodes
              topic and vocabulary far more strongly than stance, so{" "}
              <em>we cannot guarantee your data never leaves the US</em> scores{" "}
              <span className="font-ui tabular-nums">0.978</span> against the
              data-residency examples while the actual promise scores{" "}
              <span className="font-ui tabular-nums">0.964</span>. Similarity alone would
              put a card under the most careful sentence in the draft.
            </ProseP>
          </ProseSection>

          <ProseSection
            index="04"
            id="why-local"
            title="Why it runs on your machine"
            spaceAbove="large"
          >
            <ProseP>
              This is a design constraint rather than a feature added later. The reasoning
              below is about why this product is built this way. None of it is a claim
              about anyone else&rsquo;s software, and none of it is legal advice.
            </ProseP>
            <ProseP>
              Section 7 of the NLRA protects most private-sector employees discussing pay
              and working conditions. Regulators have at times pressed for heightened
              scrutiny of monitoring technology on that basis; the specific NLRB General
              Counsel guidance from 2022 was rescinded in February 2025, and enforcement
              posture here moves with each administration, which is exactly why we did not
              want the architecture to depend on it.
            </ProseP>
            <ProseP>
              In Germany, §87(1)(6) BetrVG gives a works council, where one exists,
              co-determination over technical devices for monitoring behaviour or
              performance, and German case law reads capability rather than intent as the
              trigger. Under EU and UK data-protection law, monitoring employee messages
              is the kind of processing supervisory authorities treat as likely high-risk,
              so a DPIA is normally required, and employee consent is a weak basis because
              of the power imbalance.
            </ProseP>
            <ProseCallout>
              <p>
                So: nothing you type leaves your computer, there is no endpoint that could
                receive it, there is no console showing anyone what anyone typed, there
                are no per-person scores, and the rule set excludes pay, hours, working
                conditions, and organizing by construction.
              </p>
            </ProseCallout>
            <ProseP>
              None of that is a policy you have to take on trust. The site is a set of
              static files, its content security policy permits connections to this origin
              and nowhere else, and the network tab is the entire audit.
            </ProseP>
          </ProseSection>

          <ProseSection
            index="05"
            id="not-built"
            title="What is deliberately not built"
            spaceAbove="default"
          >
            <ProseList>
              <ProseListItem>
                <strong>No console.</strong> There is no view where anyone could read
                what you typed. That is not a permission left switched off; the surface
                does not exist.
              </ProseListItem>
              <ProseListItem>
                <strong>No telemetry of any kind.</strong> The status line under the
                composer counts anything that leaves the page after the checker is ready,
                and it reads zero because there is nothing to send.
              </ProseListItem>
              <ProseListItem>
                <strong>Eight rules rather than eighty.</strong> Every additional rule
                is additional surface for false positives, and false positives are what
                get a tool like this switched off in the first week.
              </ProseListItem>
              <ProseListItem>
                <strong>No holding anything back.</strong> It advises and never refuses.
                The reviewed wording is offered first and a generated version second,
                never preselected.
              </ProseListItem>
            </ProseList>
          </ProseSection>

          <ProseSection index="06" id="the-rules" title="The rules, in full" spaceAbove="extra">
            <ProseP>
              Eight rules ship in the demo. Six apply only when the recipient is outside
              your company, which is what makes the recipient switch mean something. Tone
              and language apply everywhere, because how a sentence lands does not depend
              on the domain in the address.
            </ProseP>
            <ProseFigure label="The eight rules, their severities and their scope">
              <RulesTable />
              <p className="mt-3 text-xs text-ink-muted sm:hidden">
                The table scrolls sideways here to reach scope and precision.
              </p>
              <ProseFigureNote>
                No rule here has a published precision figure. Every rule is still tuned
                by guesswork rather than by measurement, and none has been scored against
                a held-out sample, so the honest entry is that it is not yet measured out
                of sample. An in-sample number would look precise and would be the least
                true thing on this site.
              </ProseFigureNote>
            </ProseFigure>
          </ProseSection>

          <ProseSection index="07" id="roadmap" title="What comes next" spaceAbove="large">
            <ProseSubheading>
              The same checks inside the tools teams already use
            </ProseSubheading>
            <ProseP>
              The composer on this site is a demonstration. The intended form is a browser
              extension, with the checker staying inside the extension and the draft never
              leaving the page it was typed on. That layer advises and is bypassable.
              Going from advice to enforcement would mean a managed-browser integration
              rather than a content script, and we would only build that for someone who
              asked for enforcement rather than coaching.
            </ProseP>
            <ProseSubheading>
              Policy authoring, with a precision harness in front of it
            </ProseSubheading>
            <ProseP>
              Writing a rule should not be the same act as switching it on. The next
              version measures a candidate rule&rsquo;s false-positive rate against a
              sample corpus before it can go live.
            </ProseP>
            <ProseSubheading>A distilled, task-specific classifier</ProseSubheading>
            <ProseP>
              A smaller classifier trained for this exact task would be faster and more
              accurate than similarity against examples. It is not in this version for a
              plain reason: training only on synthetic data bakes in the trainer&rsquo;s
              blind spots, and offline evaluation then flatters you because the test set
              is synthetic too. The gating requirement is a human-adjudicated gold set
              drawn from real drafts, and that does not exist on day one.
            </ProseP>
          </ProseSection>

          <ProseSection index="08" id="disclaimer" title="One last thing" spaceAbove="large">
            <ProseCallout tone="quiet">
              <p className="font-ui text-sm">{COPY.disclaimer}</p>
            </ProseCallout>
          </ProseSection>
        </Prose>
      </main>

      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-app items-baseline justify-between gap-4 px-4 py-6 sm:px-6">
          <p className="text-sm text-ink-secondary">{COPY.subtitle}</p>
          <nav aria-label="Elsewhere" className="flex shrink-0 items-baseline gap-5 text-sm">
            <Link href="/" className="hover:underline">
              The product
            </Link>
            <a href={GITHUB_URL} rel="noreferrer" className="hover:underline">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
