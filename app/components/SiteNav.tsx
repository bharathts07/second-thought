import type { ComponentPropsWithoutRef } from "react";

/**
 * SiteNav: The global navigation chrome for Second Thought.
 *
 * Order: wordmark "Second Thought" linking to "/", then Announcement, Roadmap,
 * Privacy, Settings (with gear icon), and GitHub (external).
 *
 * The current page's entry is marked with aria-current="page" and a visible
 * treatment that is not colour alone (underline in the accent).
 *
 * Settings carries a gear icon BEFORE its label. It is the ONE functional icon
 * on the site: no other item gets an icon, and no icon set is started.
 *
 * Six items at 390px is a lot. The nav wraps to multiple lines if needed, and
 * every destination remains reachable without a hamburger or modal.
 *
 * This is chrome. It must not compete with the page: quiet type, no fills
 * except the current-page marker.
 */

type Page = "home" | "announcement" | "roadmap" | "privacy" | "settings";

interface SiteNavProps extends Omit<ComponentPropsWithoutRef<"nav">, "children"> {
  /**
   * The current page. Exactly one entry will be marked with aria-current="page"
   * and visually indicated.
   */
  current: Page;
}

/**
 * GearIcon: A small gear svg for the Settings link only.
 * Inline, aria-hidden, currentColor, hairline stroke (1px), no fill.
 * Sized to the text (1em square with some breathing room).
 */
function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block"
      style={{ marginRight: "0.375rem" }}
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M15 8h-2M3 8H1M13.24 13.24l-1.41-1.41M4.17 4.17L2.76 2.76M13.24 2.76l-1.41 1.41M4.17 11.83l-1.41 1.41" />
    </svg>
  );
}

export function SiteNav({ current, className = "", ...props }: SiteNavProps) {
  // Link styles: quiet by default, underlined in accent when current
  const linkClass = "text-ink-secondary hover:text-ink transition-control";
  const currentLinkClass = `${linkClass} underline decoration-accent decoration-2 underline-offset-4`;

  return (
    <nav
      className={`flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-hairline px-4 py-3 text-sm ${className}`}
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
        href="/privacy"
        className={current === "privacy" ? currentLinkClass : linkClass}
        aria-current={current === "privacy" ? "page" : undefined}
      >
        Privacy
      </a>

      <a
        href="/settings"
        className={current === "settings" ? currentLinkClass : linkClass}
        aria-current={current === "settings" ? "page" : undefined}
      >
        <GearIcon />
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
