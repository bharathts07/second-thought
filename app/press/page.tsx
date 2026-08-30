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
              Know what you just promised, before you hit send.
            </ProseTitle>
            <ProseLead>
              Second Thought reads the message you are drafting, and when a
              sentence promises more than you can stand behind, a short note
              appears under the composer with wording you could use instead. It
              runs inside your browser: the checks happen on your own machine, and
              there is no server that could receive what you type.
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

          <ProseSection index="01" id="the-problem" title="The problem, sized">
            <ProseP>
              Regulators have issued fines totalling over $3B since 2021 over how
              business communications were kept and supervised. That figure is
              worth stating once and then setting aside, because almost none of
              what sits behind it was malicious.
            </ProseP>
            <ProseP>
              The ordinary version is much smaller and much more common. Someone
              types a promise they are not authorised to make, in a thread with a
              customer in it, and nobody notices until it is a contract dispute.
              The sentence took four seconds to write. Everything slow and
              expensive that follows is downstream of those four seconds.
            </ProseP>
          </ProseSection>

          <ProseSection index="02" id="the-timing" title="The timing is the problem">
            <ProseP>
              Most tooling in this space works after the fact, by capturing and
              reviewing messages that have already been sent. That is genuinely
              useful for keeping records, and it is no use at all to the person
              who is about to send one.
            </ProseP>
            <ProseP>
              The useful moment is the few seconds before the message leaves, and
              what makes it useful is knowing who the recipient is.{" "}
              <em>We guarantee your data never leaves the US</em> is loose
              shorthand between two colleagues who both know how the deployment is
              configured. Sent to a customer, the same sentence is a commitment. A
              check that cannot tell those two situations apart has to either stay
              quiet in both or speak up in both, and neither is worth having.
            </ProseP>
          </ProseSection>

          <ProseSection index="03" id="the-product" title="What it actually is">
            <ProseP>
              Second Thought sits under the composer and says nothing at all until
              a sentence is worth a second thought. When one is, a card appears
              with the rule in plain language, the reason that phrasing is risky,
              and suggested wording you can take with one click or leave alone.
              Nothing is ever held back from sending, and the suggestion is
              offered rather than applied.
            </ProseP>
            <ProseP>
              The gesture that explains the product takes about two seconds:
              switch the recipient from your own team to a customer, leave the
              draft exactly as it is, and watch what it flags change.{" "}
              <TextLink href="/">Try it in this browser</TextLink>, which is the
              only place it runs.
            </ProseP>
          </ProseSection>

          <ProseSection index="04" id="how-it-works" title="How it works">
            <ProseP>
              A scan runs in stages, cheapest first. A context gate decides which
              rules apply to this recipient at all. A deterministic stage then
              runs patterns and literal terms over the raw draft; it needs no
              model, so the page is already doing something useful in its first
              second while the rest is still downloading. Only then does the
              semantic stage run, and a rule fires there only when a cue phrase is
              present, no negation governs that cue, and the sentence clears that
              rule&rsquo;s similarity threshold against its examples.
            </ProseP>
            <ProseP>
              All three conditions are needed, and the reason is measurable rather
              than theoretical. Mean-pooled embeddings encode topic and vocabulary
              far more strongly than stance, so{" "}
              <em>we cannot guarantee your data never leaves the US</em> scores{" "}
              <span className="font-ui tabular-nums">0.978</span> against the
              data-residency examples while the actual promise scores{" "}
              <span className="font-ui tabular-nums">0.964</span>. Similarity on
              its own would put a card under the most careful sentence in the
              draft, at maximum confidence.
            </ProseP>
            <ProseP>
              Two models, with two different jobs. Detection is a 22MB sentence
              encoder, downloaded once and kept in your browser cache, whose only
              task is to turn a sentence into a vector that can be compared with a
              handful of examples. Rewriting is a much larger generative model
              with a task the encoder cannot do: phrasing the suggestion in your
              voice instead of the rule&rsquo;s. It loads in the background, and
              its absence changes nothing you can see, because the reviewed
              wording is always there.
            </ProseP>
            <ProseP>
              Detection uses a small encoder rather than a generative model
              because it has to run at every pause in typing, where a comparison
              against a few vectors costs milliseconds and asking a generative
              model for a judgement costs seconds. Measured so far: 21.9 MiB for
              the encoder file, and roughly 2 ms to embed a three-sentence batch
              on a CPU backend. First load on a cold cache has not been timed on a
              fresh machine yet, so there is no number for it on this page.
            </ProseP>
          </ProseSection>
          <ProseSection
            index="05"
            id="why-local"
            title="Why it runs on your machine"
          >
            <ProseP>
              This is a design constraint rather than a feature that was added
              later, and the reasoning below is about why this product is built
              this way. None of it is a claim about anyone else&rsquo;s software,
              and none of it is legal advice.
            </ProseP>
            <ProseP>
              Section 7 of the NLRA protects most private-sector employees
              discussing pay and working conditions. Regulators have at times
              pressed for heightened scrutiny of monitoring technology on that
              basis; the specific NLRB General Counsel guidance from 2022 was
              rescinded in 2026, and enforcement posture here moves with each
              administration, which is exactly why we did not want the
              architecture to depend on it.
            </ProseP>
            <ProseP>
              In Germany, §87(1)(6) BetrVG gives a works council, where one
              exists, co-determination over technical devices for monitoring
              behaviour or performance, and German case law reads capability rather
              than intent as the trigger. Under EU and UK data-protection law,
              monitoring employee messages is the kind of processing supervisory
              authorities treat as likely high-risk, so a DPIA is normally
              required, and employee consent is a weak basis because of the power
              imbalance.
            </ProseP>
            <ProseCallout>
              <p>
                So: nothing you type leaves the device, there is no endpoint that
                could receive it, there is no console showing anyone what anyone
                typed, there are no per-person scores, and the rule set excludes
                pay, hours, working conditions, and organizing by construction.
              </p>
            </ProseCallout>
            <ProseP>
              None of that is a policy you have to take on trust. The site is a
              set of static files, its content security policy permits connections
              to this origin and nowhere else, and the model weights are served
              from this domain alongside the page, so the network tab is the
              entire audit: after the one-time download there is nothing further
              to see.
            </ProseP>
          </ProseSection>

          <ProseSection
            index="06"
            id="not-built"
            title="What is deliberately not built"
          >
            <ProseList>
              <ProseListItem>
                <strong>No console.</strong> There is no view where a manager, an
                administrator, or we could read what you typed. That is not a
                permission left switched off; the surface does not exist, and
                nothing is transmitted that could fill one.
              </ProseListItem>
              <ProseListItem>
                <strong>No telemetry of any kind.</strong> No analytics, no crash
                reporting, no counters. The status line under the composer counts
                network requests made after the checker is ready, and it reads zero
                because there is nothing to send.
              </ProseListItem>
              <ProseListItem>
                <strong>Eight rules rather than eighty.</strong> Every additional
                rule is additional surface for false positives, and false
                positives, rather than missed detections, are what get a tool like
                this switched off in the first week.
              </ProseListItem>
              <ProseListItem>
                <strong>No holding anything back.</strong> It advises and never
                refuses, and the send button never waits on a model. The reviewed
                wording is offered first and a generated version second, never
                preselected, because a suggestion that applies itself has stopped
                being a suggestion.
              </ProseListItem>
            </ProseList>
          </ProseSection>

          <ProseSection index="07" id="the-rules" title="The rules, in full">
            <ProseP>
              Eight rules ship in the demo. Six of them apply only when the
              recipient is outside your company, which is what makes the recipient
              switch mean something; tone and language apply everywhere, because
              how a sentence lands does not depend on the domain in the address.
            </ProseP>
            <ProseFigure label="The eight rules, their severities and their scope">
              <RulesTable />
              {/* At 390px the last two columns sit off the right edge, and a
                  scroll region with no affordance is a column a reader never
                  learns exists. Visible only where the table actually scrolls. */}
              <p className="mt-3 text-xs text-ink-muted sm:hidden">
                The table scrolls sideways here to reach scope and precision.
              </p>
              <ProseFigureNote>
                No rule here has a published precision figure. Every threshold is
                still a placeholder and none has been scored against a held-out
                sample, so the honest entry is that it is not yet measured out of
                sample. An in-sample number would look precise and would be the
                least true thing on this site. Rules you write yourself will never
                appear in a table like this at all: they stay in your browser, so
                there is nothing here to measure and nobody to measure it.
              </ProseFigureNote>
            </ProseFigure>
          </ProseSection>

          <ProseSection index="08" id="roadmap" title="What comes next">
            <ProseSubheading>
              The same checks inside the tools teams already use
            </ProseSubheading>
            <ProseP>
              The composer on this site is a demonstration surface. The intended
              form is a browser extension, with the model staying inside the
              extension and the draft never leaving the page it was typed on. The
              ceiling is worth naming in the same breath: that layer advises, it is
              bypassable, and going from advice to enforcement would mean a
              managed-browser integration rather than a content script. We would
              only build that for someone who asked for enforcement rather than
              coaching.
            </ProseP>
            <ProseSubheading>
              Policy authoring, with a precision harness in front of it
            </ProseSubheading>
            <ProseP>
              Writing a rule should not be the same act as switching it on. The
              next version measures a candidate rule&rsquo;s false-positive rate
              against a sample corpus before it can go live, which today is a
              build technique and belongs in the product.
            </ProseP>
            <ProseSubheading>A distilled, task-specific classifier</ProseSubheading>
            <ProseP>
              A smaller model trained for this exact task, with confidence-based
              escalation for ambiguous sentences, would be faster and more accurate
              than similarity against examples. It is not in this version for a
              plain reason: training only on synthetic data generated by a teacher
              model bakes in that model&rsquo;s blind spots, and offline evaluation
              then flatters you because the test set is synthetic too. The gating
              requirement is a human-adjudicated gold set drawn from real drafts,
              and that does not exist on day one.
            </ProseP>
          </ProseSection>

          <ProseSection index="09" id="disclaimer" title="One last thing">
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
