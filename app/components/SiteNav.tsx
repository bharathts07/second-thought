import type { ComponentPropsWithoutRef } from "react";

/**
 * SiteNav: The global navigation chrome for Second Thought.
 *
 * Order: wordmark "Second Thought" linking to "/", then Announcement, Roadmap,
 * Settings, and GitHub (external).
 *
 * The current page's entry is marked with aria-current="page" and a visible
 * treatment that is not colour alone (underline in the accent).
 *
 * The nav is pinned to the top through scroll on every page, with a solid
 * background and a hairline bottom edge separating it from page content.
 *
 * Five items at 390px wraps to multiple lines if needed, and every destination
 * remains reachable without a hamburger or modal.
 *
 * This is chrome. It must not compete with the page: quiet type, no fills
 * except the current-page marker.
 */

type Page = "home" | "announcement" | "roadmap" | "settings";

interface SiteNavProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  /**
   * The current page. Exactly one entry will be marked with aria-current="page"
   * and visually indicated.
   */
  current: Page;
}

export function SiteNav({ current, className = "", ...props }: SiteNavProps) {
  // Link styles: quiet by default, underlined in accent when current
  const linkClass = "text-ink-secondary hover:text-ink transition-control";
  const currentLinkClass = `${linkClass} underline decoration-accent decoration-2 underline-offset-4`;

  return (
    <nav
      className={`sticky top-0 z-50 flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hairline bg-canvas px-4 py-3 text-sm ${className}`}
      {...props}
    >
      {/* Wordmark: always links home, never marked current even when on home */}
      <a
        href="/"
        className="mr-2 font-medium tracking-heading text-ink"
        aria-label="Second Thought home"
      >
        Second Thought
      </a>

      {/* Main navigation links */}
      <a
        href="/press"
        className={current === "announcement" ? currentLinkClass : linkClass}
        aria-current={current === "announcement" ? "page" : undefined}
      >
        Announcement
      </a>

      <a
        href="/roadmap"
        className={current === "roadmap" ? currentLinkClass : linkClass}
        aria-current={current === "roadmap" ? "page" : undefined}
      >
        Roadmap
      </a>

      <a
        href="/settings"
        className={current === "settings" ? currentLinkClass : linkClass}
        aria-current={current === "settings" ? "page" : undefined}
      >
        Settings
      </a>

      {/* External link to GitHub, never current */}
      <a
        href="https://github.com/bharathts07/second-thought"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        GitHub
      </a>
    </nav>
  );
}
