"use client";

/**
 * `/settings`, where every rule is visible.
 *
 * The premise, from `plan/10` T10.3: a tool that inspects your writing owes you
 * the ability to read every rule it applies. So this page is a reading surface
 * first. Three sections, rules first and expanded, and every field of every rule
 * legible without a click into anything that is not on this page.
 *
 * **Deliberately narrower than E10.** This version is read-only display plus
 * enable and disable switches held in component state. Authoring a personal rule,
 * import and export, and IndexedDB persistence are not here, because they need a
 * storage design that is not settled, and a half-built authoring form is worse
 * than an honest absence. The page says so once, as roadmap.
 *
 * Two consequences that are easy to get wrong and are load-bearing here:
 *
 *   - **No engine import.** Reading your rules must not start a 22MB download, so
 *     this page imports `COMPANY_RULES` and the types and nothing else. Rule
 *     content is never retyped: every string a row shows is read off the rule.
 *   - **Nothing on this page claims a measurement nobody made.** Thresholds are
 *     labelled as placeholders and precision reads `Not evaluated`, per T10.3.3
 *     and `content-safety.md` §5. A number with no calibration behind it looks
 *     like evidence, which is the failure mode this product exists to name.
 *
 * Strings come from `ux-spec.md` §14 where the deck has one. The deck has no
 * entries for the page's own headings, so those are taken from T10.3 verbatim and
 * checked against the §14 banned list: no violation, breach, error, warning,
 * alert, blocked, you must, risk score, offence, misconduct.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { COMPANY_RULES } from "@/app/lib/policies";
import { RuleRow, ruleRowId } from "@/app/components/RuleRow";

/** §14 copy deck, plus the section headings T10.3 names. */
const COPY = {
  backToProduct: "Second Thought",
  title: "Rules and settings",
  subtitle:
    "Every rule the check applies, what each one looks for, and what the set " +
    "deliberately does not look at.",

  rulesHeading: "Rules",
  companyRules: "From your company",
  personalRules: "Your own rules",
  demoNote:
    "In a company deployment an administrator would control these. In this demo " +
    "you can switch them off.",
  noRules: "No rules are switched on.",
  switchedOn: (on: number, total: number) => `${on} of ${total} switched on`,
  reset: "Reset to defaults",
  resetNote: "Restores the set as shipped.",

  excludedHeading: "What the set does not look at",
  excluded:
    "The rule set excludes pay, hours, working conditions, and organizing by " +
    "construction. The tone and language rules also step aside on any sentence " +
    "that discusses those subjects, so a conversation about them is never the " +
    "thing a card is about.",

  roadmapHeading: "On the roadmap",
  personalRoadmap:
    "Writing your own rules, importing and exporting them, and remembering any " +
    "of this between visits are on the roadmap. This version shows the set as " +
    "shipped and lets you switch rules off for the session.",

  modelsHeading: "On-device models",
  modelsLead:
    "Capability arrives in tiers, and the page does real work before any model " +
    "exists. Sizes are stated before anything downloads.",
  devicePath:
    "Whether a check runs on WebGPU or on WebAssembly is decided when the model " +
    "loads, and the status line under the composer names which one is in use, " +
    "along with the number of network requests since it was ready.",
  modelsRoadmap:
    "Turning the third tier on from here, and clearing what this browser has " +
    "cached, belong in this section and are not wired up yet.",

  privacyHeading: "Privacy",
  // Leads with what is true of THIS build. The previous wording opened by
  // claiming rules are stored in this browser and corrected itself two
  // paragraphs later, which is the wrong order for a privacy statement: the
  // reader should not have to keep reading to find out the first sentence was
  // aspirational.
  privacyStored:
    "Messages you draft are never stored and never sent. When rule editing " +
    "ships, the rules you write will be kept in this browser and nowhere else.",
  privacyMemory:
    "Drafts, findings, and the notes you keep for yourself are held in memory " +
    "only and are gone when you close the tab. There is nothing to export and " +
    "nothing to hand over.",
  privacyThisBuild:
    "In this version nothing is written to any of those surfaces at all: the " +
    "switches above last until you reload the page.",
  privacyRoadmap:
    "“Delete everything stored” will clear all three in one action. It " +
    "is not wired up yet, and an action that cleared two of the three would be " +
    "worth less than an honest absence.",

  disclaimer:
    "Second Thought is a drafting aid. It does not provide legal or compliance advice and " +
    "does not ensure compliance with any law, regulation, or company policy.",
} as const;

/** The three tiers from `hosting-and-load.md` §5, in the order they arrive. */
const TIERS: readonly { name: string; size: string; detail: string }[] = [
  {
    name: "The page itself",
    size: "~150KB",
    detail:
      "Arrives immediately. Pattern checks are already running: secrets, " +
      "personal-data shapes, and term lists.",
  },
  {
    name: "Wording checks",
    size: "~22MB",
    detail:
      "Wording checks need a one-time 22MB download. It happens once and stays " +
      "in this browser's cache, which is why nothing you type has to leave your " +
      "machine.",
  },
  {
    name: "Rewrite in your voice",
    size: "~280MB",
    detail:
      "Also suggest wording in your own voice · one-time 280MB download · runs " +
      "on your device. Only if you ask for it.",
  },
];

/**
 * The three PERSISTENT surfaces from `ux-spec.md` §12, and only those three. What
 * lives in memory is stated as a sentence below the list rather than as a fourth
 * row, because the distinction between the two is the whole privacy argument and a
 * row in the same table blurs it.
 */
const STORAGE: readonly { what: string; where: string }[] = [
  { what: "Your preferences", where: "This browser's local storage" },
  { what: "Rules you write", where: "This browser's database, with their vectors" },
  { what: "Model files", where: "This browser's cache storage" },
];

/** Read once at module load. `Reset to defaults` restores exactly this. */
const DEFAULT_ENABLED: Readonly<Record<string, boolean>> = Object.fromEntries(
  COMPANY_RULES.map((rule) => [rule.id, rule.enabled]),
);

/**
 * The small-caps label that opens a block. The same treatment the card uses above
 * its title, so a heading here and a heading there are recognisably one system.
 */
function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-2xs font-medium tracking-label text-ink-muted">{children}</p>
  );
}

/**
 * The id is a literal rather than a `useId`, so `/settings#rules` and the card's
 * `Edit this rule` link both land somewhere. Nothing generates these names.
 */
function Section({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="scroll-mt-6 text-lg font-semibold tracking-tight text-ink">
        {heading}
      </h2>
      {children}
    </section>
  );
}

/** One bordered surface holding a hairline-separated list. Used by all three sections. */
const PANEL = "divide-y divide-hairline rounded-lg border border-hairline bg-surface";

/**
 * Mirrors the action class in `FindingCard.tsx` on purpose: a control that does
 * the same kind of work should not look different because it is on another page.
 */
const ACTION_CLASS =
  "w-full sm:w-auto rounded-md border border-control bg-surface px-3 py-2 " +
  "text-sm font-medium text-ink transition-quiet hover:bg-sunken";

export default function SettingsPage() {
  /**
   * Component state, and that is the whole of it. No `localStorage`, no database:
   * see the file header. The privacy section says out loud that these switches do
   * not survive a reload, because a settings page that silently forgets is the
   * kind of small dishonesty this product cannot afford.
   */
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => ({
    ...DEFAULT_ENABLED,
  }));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const handleEnabledChange = useCallback((ruleId: string, next: boolean) => {
    setEnabled((current) => ({ ...current, [ruleId]: next }));
  }, []);

  const handleExpandedChange = useCallback((ruleId: string, next: boolean) => {
    setExpanded((current) => {
      const draft = new Set(current);
      if (next) draft.add(ruleId);
      else draft.delete(ruleId);
      return draft;
    });
  }, []);

  const handleReset = useCallback(() => {
    setEnabled({ ...DEFAULT_ENABLED });
  }, []);

  const onCount = useMemo(
    () => COMPANY_RULES.filter((rule) => enabled[rule.id]).length,
    [enabled],
  );

  /**
   * A card's `Edit this rule` link arrives as `#rule-<id>` (T10.3.8). Someone who
   * disagrees with a rule wants to read that rule, so the row opens itself, and
   * the scroll is asked for again on the next frame because the browser aimed at
   * the row while it was still collapsed.
   */
  useEffect(() => {
    const openFromHash = () => {
      const target = window.location.hash.slice(1);
      const rule = COMPANY_RULES.find((candidate) => ruleRowId(candidate.id) === target);
      if (!rule) return;
      setExpanded((current) => new Set(current).add(rule.id));
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ block: "center" });
      });
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-app flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        {/* Back to the product, first thing, because this page is a detour. */}
        <Link href="/" className="w-fit text-sm">
          {COPY.backToProduct}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-ink">{COPY.title}</h1>
        <p className="max-w-reading text-sm text-ink-secondary">{COPY.subtitle}</p>
      </header>

      <main className="flex flex-col gap-10">
        <Section id="rules" heading={COPY.rulesHeading}>
          {/* The exclusion is stated before the list rather than under it. It is a
              property of the set, and D23 is the reason the product is defensible. */}
          <div className="flex flex-col gap-1">
            <Eyebrow>{COPY.excludedHeading}</Eyebrow>
            <p className="max-w-reading text-md text-ink-secondary">{COPY.excluded}</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <Eyebrow>{COPY.companyRules}</Eyebrow>
                <p className="text-sm text-ink-secondary">
                  {onCount === 0
                    ? COPY.noRules
                    : COPY.switchedOn(onCount, COMPANY_RULES.length)}
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-1 sm:items-end">
                <button type="button" className={ACTION_CLASS} onClick={handleReset}>
                  {COPY.reset}
                </button>
                <p className="text-2xs text-ink-muted">{COPY.resetNote}</p>
              </div>
            </div>

            <p className="max-w-reading text-sm text-ink-secondary">{COPY.demoNote}</p>

            <ul className={PANEL}>
              {COMPANY_RULES.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  enabled={enabled[rule.id] ?? rule.enabled}
                  expanded={expanded.has(rule.id)}
                  onEnabledChange={handleEnabledChange}
                  onExpandedChange={handleExpandedChange}
                />
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-1">
            <Eyebrow>{COPY.personalRules}</Eyebrow>
            <p className="max-w-reading text-sm text-ink-secondary">
              {COPY.personalRoadmap}
            </p>
          </div>
        </Section>

        <Section id="models" heading={COPY.modelsHeading}>
          <p className="max-w-reading text-md text-ink-secondary">{COPY.modelsLead}</p>

          {/* Not a table: at 390px a four-column table of sizes and prose wraps into
              something nobody reads. One row per tier, size in the mono face, which
              keeps the three figures scannable in a column. */}
          <ul className={PANEL}>
            {TIERS.map((tier) => (
              <li key={tier.name} className="flex flex-col gap-1 px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-base font-medium text-ink">{tier.name}</span>
                  <span className="font-mono text-xs text-ink-secondary">{tier.size}</span>
                </div>
                <p className="max-w-reading text-sm text-ink-secondary">{tier.detail}</p>
              </li>
            ))}
          </ul>

          <p className="max-w-reading text-sm text-ink-secondary">{COPY.devicePath}</p>

          <div className="flex flex-col gap-1">
            <Eyebrow>{COPY.roadmapHeading}</Eyebrow>
            <p className="max-w-reading text-sm text-ink-secondary">
              {COPY.modelsRoadmap}
            </p>
          </div>
        </Section>

        <Section id="privacy" heading={COPY.privacyHeading}>
          {/* The deck's own string, and it is precise because it was corrected once
              for overclaiming: rules you write ARE stored, so a blanket "nothing you
              type is stored" was falsifiable in two clicks (F14). */}
          <p className="max-w-reading text-md text-ink">{COPY.privacyStored}</p>

          <ul className={PANEL}>
            {STORAGE.map((surface) => (
              <li
                key={surface.what}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
              >
                <span className="text-sm font-medium text-ink">{surface.what}</span>
                <span className="text-sm text-ink-secondary">{surface.where}</span>
              </li>
            ))}
          </ul>

          <p className="max-w-reading text-md text-ink-secondary">
            {COPY.privacyMemory}
          </p>

          <p className="max-w-reading text-sm text-ink-secondary">
            {COPY.privacyThisBuild}
          </p>

          <div className="flex flex-col gap-1">
            <Eyebrow>{COPY.roadmapHeading}</Eyebrow>
            <p className="max-w-reading text-sm text-ink-secondary">
              {COPY.privacyRoadmap}
            </p>
          </div>
        </Section>
      </main>

      <footer className="mt-auto border-t border-hairline pt-4 text-xs text-ink-muted">
        <p className="max-w-reading">{COPY.disclaimer}</p>
      </footer>
    </div>
  );
}
