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
import { SiteNav } from "@/app/components/SiteNav";
import { Band } from "@/app/components/Band";
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
  ProseSectionHeading,
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
  title: "Second Thought · Announcement",
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


export default function PressPage() {
  return (
    <div className="min-h-screen">
      <SiteNav current="announcement" />

      <main>
        <Band tone="paper" as="div">
          <Prose>
            <div className="flex flex-col gap-4">
              <ProseEyebrow>Announcement</ProseEyebrow>
              <ProseTitle>
                Stay inside your company&rsquo;s rules, before you hit send.
              </ProseTitle>
              <ProseLead>
                Second Thought reads your draft locally, points out risky phrasing,
                and offers safer wording.
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
          </Prose>
        </Band>


        <Band tone="tint" as="section" id="how-it-works" aria-labelledby="how-it-works-heading">
          <Prose>
            <ProseSectionHeading id="how-it-works-heading">
              How it works
            </ProseSectionHeading>
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
          </Prose>
        </Band>


        <Band tone="paper" as="section" id="why-local" aria-labelledby="why-local-heading">
          <Prose>
            <ProseSectionHeading id="why-local-heading">
              Why it runs on your machine
            </ProseSectionHeading>
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
              The site is static files, its content security policy permits connections
              to this origin only, and the network tab is the entire audit.
            </ProseP>
          </Prose>
        </Band>


        <Band tone="tint" as="section" id="not-built" aria-labelledby="not-built-heading">
          <Prose>
            <ProseSectionHeading id="not-built-heading">
              What is deliberately not built
            </ProseSectionHeading>
            <ProseList>
              <ProseListItem>
                <strong>No telemetry of any kind.</strong> The status line under the
                composer counts anything that leaves the page, and it reads zero.
              </ProseListItem>
              <ProseListItem>
                <strong>Eight rules rather than eighty.</strong> Every additional rule
                is surface for false positives, which get a tool switched off.
              </ProseListItem>
            </ProseList>
          </Prose>
        </Band>


        <Band tone="paper" as="section" id="the-rules" aria-labelledby="the-rules-heading">
          <Prose>
            <ProseSectionHeading id="the-rules-heading">
              The rules, in full
            </ProseSectionHeading>
            <ProseP>
              Eight rules ship in the demo. Six apply only to external recipients.
              Tone and language apply everywhere.
            </ProseP>
            <ProseFigure label="The eight rules, their severities and their scope">
              <RulesTable />
              <p className="mt-3 text-xs text-ink-muted sm:hidden">
                The table scrolls sideways here to reach scope and precision.
              </p>
              <ProseFigureNote>
                No rule here has a published precision figure. Every rule is tuned by
                guesswork, not measurement, and none has been scored against a held-out
                sample.
              </ProseFigureNote>
            </ProseFigure>
          </Prose>
        </Band>


        <Band tone="tint" as="section" id="roadmap" aria-labelledby="roadmap-heading">
          <Prose>
            <ProseSectionHeading id="roadmap-heading">
              What comes next
            </ProseSectionHeading>
            <ProseSubheading>
              The same checks inside tools teams already use
            </ProseSubheading>
            <ProseP>
              The composer here is a demonstration. The intended form is a browser
              extension.
            </ProseP>
            <ProseSubheading>
              Policy authoring with a precision harness
            </ProseSubheading>
            <ProseP>
              The next version measures a candidate rule&rsquo;s false-positive rate
              against a sample corpus before it goes live.
            </ProseP>
            <ProseSubheading>A task-specific classifier</ProseSubheading>
            <ProseP>
              A smaller classifier trained for this exact task would be faster and more
              accurate than similarity against examples.
            </ProseP>
          </Prose>
        </Band>


        <Band tone="paper" as="section" id="disclaimer" aria-labelledby="disclaimer-heading">
          <Prose>
            <ProseSectionHeading id="disclaimer-heading">
              One last thing
            </ProseSectionHeading>
            <ProseCallout tone="quiet">
              <p className="font-ui text-sm">{COPY.disclaimer}</p>
            </ProseCallout>
          </Prose>
        </Band>
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
