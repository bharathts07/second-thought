/**
 * The editorial layer, used by `/press` and by nothing else yet.
 *
 * This exists as a component rather than as a set of classes on the page because
 * the press page is the one long-form surface in the product, and long-form has
 * exactly two things to get right: a measure short enough to read, and a
 * consistent vertical rhythm. Both are easy to break one paragraph at a time when
 * every element carries its own utilities.
 *
 * Three decisions are enforced here by construction.
 *
 * **The measure lives on the text, not on the column.** `Prose` sets no width.
 * Every text element carries the measure on its own, so an element that is
 * deliberately wider, which on this page means the rules table, simply does not
 * opt in. The alternative, a narrow centred column with negative margins to break
 * out of it, puts a raw value in a component the first time anything needs to be
 * wide.
 *
 * **Serif is for prose only.** `--typeface-serif` exists to make an authored page
 * feel authored, and the moment it leaks into UI furniture, the labels and the
 * table, the page starts reading as a document rather than as part of the
 * product. So the body and headings are serif and every small label is `font-ui`.
 *
 * **Rhythm comes from one gap and one section margin.** Paragraph spacing is a
 * single `gap-5` inside a section, and the space above a heading is the section's
 * own `mt-12`. Two values, no per-element margins, so nothing can drift.
 *
 * No motion here at all, deliberately. The one animated moment in this product is
 * a guidance card arriving; a paragraph that fades in on a press page is
 * decoration competing with the thing that matters.
 */

import type { ReactNode } from "react";

/**
 * The measure, applied per element. See the header note.
 *
 * Now uses max-w-reading (the widened token) rather than a hardcoded value, so
 * the measure follows the design system's prose width. The rules table keeps
 * min-w-reading, so a data table reads as a figure breaking the column rather
 * than as a table squeezed into a paragraph.
 */
const MEASURE = "max-w-reading";

/**
 * The typographic base for a whole article: serif at 17px with 1.65 leading.
 * Rendered as `<article>` because that is what this is, and it gives assistive
 * technology a document boundary without a redundant `role`.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <article className="font-serif text-prose text-ink">{children}</article>
  );
}

/**
 * The one h1. 28px on small screens and 36px from `sm`, which is the pair
 * tokens.css reserves for exactly this heading, and `tracking-tight` because the
 * letter-spacing token is licensed at 22px and up.
 */
export function ProseTitle({ children }: { children: ReactNode }) {
  return (
    <h1
      className={`${MEASURE} text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl`}
    >
      {children}
    </h1>
  );
}

/**
 * A small UI-font label above the title or above a section heading. Uppercase
 * with `tracking-label`, muted ink on the page canvas, which measures 5.62:1
 * light and 5.76:1 dark.
 */
export function ProseEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-ui text-2xs font-medium tracking-label text-ink-muted uppercase">
      {children}
    </p>
  );
}

/**
 * The subhead under the title. Larger than body and in secondary ink, so it
 * reads as one step down from the headline rather than as a first paragraph.
 */
export function ProseLead({ children }: { children: ReactNode }) {
  return (
    <p className={`${MEASURE} text-lg text-ink-secondary`}>{children}</p>
  );
}

/**
 * A numbered section.
 *
 * The numeral is the ONE thing Marginalia allows to be visually large. It is
 * deliberate editorial furniture: on a page this long it gives the reader a sense
 * of position, and it lets the sections carry short titles. The numeral sits
 * large (24px) with a hairline margin rule underneath, making the section break
 * an unmistakable editorial device rather than an incidental label.
 *
 * `gap-5` is the paragraph rhythm for everything inside. Vertical spacing above
 * the section now varies per caller to give the page rhythm.
 */
export function ProseSection({
  index,
  title,
  id,
  children,
  spaceAbove = "default",
}: {
  index: string;
  title: string;
  id: string;
  children: ReactNode;
  /** Controls the margin above this section for varied rhythm. */
  spaceAbove?: "default" | "large" | "extra";
}) {
  const marginClass = {
    default: "mt-10",
    large: "mt-12",
    extra: "mt-16",
  }[spaceAbove];

  return (
    <section aria-labelledby={id} className={`${marginClass} flex flex-col gap-5`}>
      <div className="flex flex-col gap-3">
        {/* The numeral as editorial furniture: large, with a margin rule. */}
        <div className="flex flex-col gap-2">
          <p className="font-ui text-xl font-semibold tracking-tight text-ink-secondary tabular-nums">
            {index}
          </p>
          <div className="h-px w-12 bg-hairline" aria-hidden="true" />
        </div>
        <h2
          id={id}
          className={`${MEASURE} text-xl font-semibold tracking-tight text-ink`}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

/** A sub-heading inside a section. 18px, the step between h2 and body. */
export function ProseSubheading({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <h3 id={id} className={`${MEASURE} text-lg font-semibold text-ink`}>
      {children}
    </h3>
  );
}

/** A paragraph. The measure and the leading come from here, never from callers. */
export function ProseP({ children }: { children: ReactNode }) {
  return <p className={MEASURE}>{children}</p>;
}

/**
 * A list that still reads as prose: hanging bullets outside the text block, so
 * the left edge of the wrapped lines stays aligned with the paragraphs above.
 */
export function ProseList({ children }: { children: ReactNode }) {
  return (
    <ul className={`${MEASURE} flex list-disc flex-col gap-3 pl-5`}>
      {children}
    </ul>
  );
}

export function ProseListItem({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

/**
 * A block set apart from the argument around it: the payoff of the local-first
 * section, and the disclaimer.
 *
 * A sunken surface with a full hairline, never a coloured left stripe and never
 * a filled severity panel. The stripe is a habit worth breaking on its own
 * merits, and a filled tint here would collide with the severity vocabulary,
 * which in this system means one thing only.
 *
 * `--text-muted` is licensed on `--surface-sunken` (5.34:1 light, 5.63:1 dark)
 * but not on any tinted fill, so `tone="quiet"` is safe precisely because this
 * block is a neutral surface rather than a wash.
 */
export function ProseCallout({
  children,
  tone = "primary",
}: {
  children: ReactNode;
  tone?: "primary" | "quiet";
}) {
  const ink = tone === "quiet" ? "text-ink-muted" : "text-ink";
  return (
    <div
      className={`${MEASURE} rounded-lg border border-hairline bg-sunken px-5 py-4 ${ink}`}
    >
      {children}
    </div>
  );
}

/**
 * The escape hatch from the measure, for the rules table.
 *
 * It carries no width of its own: it fills whatever the page frame is, which is
 * wider than the text column, so a data table reads as a figure breaking the
 * column rather than as a table squeezed into a paragraph. `font-ui` because the
 * table is UI, per the serif rule in the header note.
 */
export function ProseFigure({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <figure className="font-ui" aria-label={label}>
      {children}
    </figure>
  );
}

/**
 * The line under a figure. UI font at 13px in secondary ink, so it is clearly
 * apparatus rather than argument, and still comfortably readable.
 */
export function ProseFigureNote({ children }: { children: ReactNode }) {
  return (
    <figcaption className={`${MEASURE} mt-4 text-sm text-ink-secondary`}>
      {children}
    </figcaption>
  );
}
