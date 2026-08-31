import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

/**
 * Band: A full-bleed section with alternating background tones.
 *
 * The background spans the viewport edge to edge, no horizontal overflow at any
 * width. Content inside is centred at the app measure (58rem). Bands alternate
 * down the page: paper, tint, paper, tint.
 *
 * The colour change IS the boundary between sections. A band with a border
 * would be a card, not a band.
 *
 * Usage:
 *   <Band tone="paper" as="section">...</Band>
 *   <Band tone="tint">...</Band>  // defaults to section
 */

interface BandOwnProps<T extends ElementType = "section"> {
  /**
   * The background tone. Alternate down the page for rhythm:
   * paper (warm neutral) -> tint (paper + blue wash) -> paper -> tint
   */
  tone: "paper" | "tint";
  /**
   * The element to render. Defaults to "section" for semantic HTML.
   * May also be "div" when the content is not a section.
   */
  as?: T;
  children: ReactNode;
}

type BandProps<T extends ElementType = "section"> = BandOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof BandOwnProps<T>>;

export function Band<T extends ElementType = "section">({
  tone,
  as,
  children,
  className,
  ...props
}: BandProps<T>) {
  const Component = as || ("section" as ElementType);

  // Full bleed: the background spans the viewport, no horizontal overflow.
  // Content is centered inside at the app measure (58rem).
  // Generous vertical padding that can be overridden via className.
  const bgClass = tone === "paper" ? "bg-surface" : "bg-tint";
  const classes = `${bgClass} py-rhythm-section ${className || ""}`;

  return (
    <Component className={classes} {...props}>
      <div className="mx-auto max-w-app px-4">{children}</div>
    </Component>
  );
}
