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
        aria-label="GitHub (opens in new tab)"
      >
        {/* GitHub mark - nominative use identifying the destination */}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="inline-block h-[1em] w-[1em] align-text-bottom"
          fill="currentColor"
        >
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        {" "}GitHub{" "}
        {/* External link indicator */}
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="inline-block h-[0.75em] w-[0.75em] align-text-top"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 2h4v4M14 2l-6 6" />
        </svg>
      </a>
    </nav>
  );
}
