/**
 * `/roadmap`, the technical disclosure page.
 *
 * Moved from the "What downloads" section of /settings, and extended with
 * the model version and current product status. This is the ONE page where
 * technical vocabulary is permitted: it exists for the reader who wants proof.
 *
 * Three sections, alternating Band tones:
 * 1. What downloads (the three tiers) - paper
 * 2. Model details - tint
 * 3. Current status - paper
 *
 * All values read from code rather than being retyped, so the page cannot
 * drift from what actually runs.
 */

import { SiteNav } from "@/app/components/SiteNav";
import { Band } from "@/app/components/Band";
import {
  MODEL_ID,
  MODEL_REVISION,
  MODEL_DTYPE,
  EMBEDDING_DIMS,
} from "@/app/lib/model";

/** Copy deck for the roadmap page. */
const COPY = {
  title: "Roadmap",
  subtitle:
    "What downloads, model details, and current status. " +
    "What ships today and what is still being built.",

  tiersHeading: "What downloads",
  tiersLead:
    "Capability arrives in tiers, and the page does real work before any " +
    "model exists. Sizes are stated before anything downloads.",

  modelHeading: "Model details",
  modelLead:
    "The model used for wording checks. Product names are trademarks of " +
    "their respective owners and are used here only to identify those products.",

  statusHeading: "Current status",
  statusLead:
    "An honest accounting of what ships today and what is still being built.",

  disclaimer:
    "Second Thought is a drafting aid. It does not provide legal or " +
    "compliance advice and does not ensure compliance with any law, " +
    "regulation, or company policy.",
} as const;

/** The three tiers from the original settings page. */
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
      "Wording checks need a one-time 22MB download. It happens once and " +
      "stays in this browser's cache, which is why nothing you type has to " +
      "leave your machine.",
  },
  {
    name: "Rewrite in your voice",
    size: "~280MB",
    detail:
      "Also suggest wording in your own voice · one-time 280MB download · " +
      "runs on your device. Only if you ask for it.",
  },
];

/** Model specifications, read from the actual constants. */
const MODEL_SPECS: readonly { label: string; value: string }[] = [
  { label: "Model", value: MODEL_ID },
  { label: "Revision", value: MODEL_REVISION },
  { label: "Quantization", value: MODEL_DTYPE },
  { label: "Embedding dimensions", value: String(EMBEDDING_DIMS) },
];

/** Feature status with honest state chips. */
type FeatureState = "shipped" | "not-built" | "placeholder";

interface Feature {
  name: string;
  state: FeatureState;
  note?: string;
}

const FEATURES: readonly Feature[] = [
  {
    name: "In-browser checker",
    state: "shipped",
  },
  {
    name: "Context gate",
    state: "shipped",
    note: "External vs internal recipient detection",
  },
  {
    name: "Deterministic stage",
    state: "shipped",
    note: "Pattern checks for secrets, personal data, and term lists",
  },
  {
    name: "Meaning-based stage",
    state: "shipped",
    note: "Semantic similarity checks against rule exemplars",
  },
  {
    name: "Similarity bars",
    state: "placeholder",
    note:
      "Every rule sits at the same untuned value. No accuracy figure " +
      "exists and none is published.",
  },
  {
    name: "Browser extension",
    state: "not-built",
    note: "The intended form for live drafting surfaces",
  },
  {
    name: "Rule authoring",
    state: "not-built",
    note: "Write and import/export your own rules",
  },
  {
    name: "Generated rewrites",
    state: "not-built",
    note: "Rewrites in the user's own words. The seam exists.",
  },
];

/** State chip: word always present, never color alone. */
function StateChip({ state }: { state: FeatureState }) {
  const label =
    state === "shipped"
      ? "Shipped"
      : state === "placeholder"
        ? "Placeholder"
        : "Not built";

  const colorClass =
    state === "shipped"
      ? "border-accent/20 bg-accent/10 text-accent"
      : state === "placeholder"
        ? "border-amber-600/20 bg-amber-600/10 text-amber-700"
        : "border-hairline bg-sunken text-ink-muted";

  return (
    <span
      className={`inline-block rounded-sm border px-2 py-0.5 text-2xs font-medium tabular-nums ${colorClass}`}
    >
      {label}
    </span>
  );
}

export default function RoadmapPage() {
  return (
    <>
      <SiteNav current="roadmap" />
      <div className="flex min-h-screen flex-col">
        {/* Header: title and subtitle, not in a Band */}
        <header className="mx-auto w-full max-w-app px-4 py-6 sm:px-6 sm:py-10">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {COPY.title}
          </h1>
          <p className="mt-2 max-w-reading text-sm text-ink-secondary">
            {COPY.subtitle}
          </p>
        </header>

        <main className="flex flex-1 flex-col">
          {/* Section 1: What downloads - paper tone */}
          <Band tone="paper" as="section" aria-labelledby="tiers">
            <h2
              id="tiers"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              {COPY.tiersHeading}
            </h2>
            <p className="mt-2 max-w-reading text-md text-ink-secondary">
              {COPY.tiersLead}
            </p>

            <ul className="mt-6 divide-y divide-hairline rounded-lg border border-hairline bg-surface">
              {TIERS.map((tier) => (
                <li key={tier.name} className="flex flex-col gap-1 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-base font-medium text-ink">
                      {tier.name}
                    </span>
                    <span className="font-mono text-xs text-ink-secondary">
                      {tier.size}
                    </span>
                  </div>
                  <p className="max-w-reading text-sm text-ink-secondary">
                    {tier.detail}
                  </p>
                </li>
              ))}
            </ul>
          </Band>

          {/* Section 2: Model details - tint tone */}
          <Band tone="tint" as="section" aria-labelledby="model">
            <h2
              id="model"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              {COPY.modelHeading}
            </h2>
            <p className="mt-2 max-w-reading text-md text-ink-secondary">
              {COPY.modelLead}
            </p>

            <dl className="mt-6 divide-y divide-hairline rounded-lg border border-hairline bg-surface">
              {MODEL_SPECS.map((spec) => (
                <div
                  key={spec.label}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 sm:px-5"
                >
                  <dt className="text-sm font-medium text-ink">{spec.label}</dt>
                  <dd className="font-mono text-sm text-ink-secondary">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Band>

          {/* Section 3: Current status - paper tone */}
          <Band tone="paper" as="section" aria-labelledby="status">
            <h2
              id="status"
              className="text-lg font-semibold tracking-tight text-ink"
            >
              {COPY.statusHeading}
            </h2>
            <p className="mt-2 max-w-reading text-md text-ink-secondary">
              {COPY.statusLead}
            </p>

            <ul className="mt-6 divide-y divide-hairline rounded-lg border border-hairline bg-surface">
              {FEATURES.map((feature) => (
                <li
                  key={feature.name}
                  className="flex flex-col gap-2 px-4 py-3 sm:px-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-base font-medium text-ink">
                      {feature.name}
                    </span>
                    <StateChip state={feature.state} />
                  </div>
                  {feature.note ? (
                    <p className="max-w-reading text-sm text-ink-secondary">
                      {feature.note}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Band>
        </main>

        {/* Footer with disclaimer */}
        <footer className="mx-auto w-full max-w-app border-t border-hairline px-4 py-4 text-xs text-ink-muted sm:px-6">
          <p className="max-w-reading">{COPY.disclaimer}</p>
        </footer>
      </div>
    </>
  );
}
