import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteNav } from "./SiteNav";

describe("SiteNav", () => {
  it("renders all five destinations", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    // Wordmark
    expect(html).toContain("Second Thought");
    expect(html).toContain('href="/"');

    // Main nav links
    expect(html).toContain("Announcement");
    expect(html).toContain('href="/press"');
    expect(html).toContain("Roadmap");
    expect(html).toContain('href="/roadmap"');
    expect(html).toContain("Settings");
    expect(html).toContain('href="/settings"');
    expect(html).toContain("GitHub");
    expect(html).toContain(
      'href="https://github.com/bharathts07/second-thought"'
    );
  });

  it("marks exactly one link as current with aria-current", () => {
    const html = renderToStaticMarkup(<SiteNav current="announcement" />);

    // Count aria-current="page" occurrences
    const matches = html.match(/aria-current="page"/g);
    expect(matches).toHaveLength(1);
  });

  it("marks the announcement page as current", () => {
    const html = renderToStaticMarkup(<SiteNav current="announcement" />);

    // The announcement link has aria-current="page"
    expect(html).toContain('href="/press"');
    expect(html).toContain('aria-current="page"');

    // Check that it's the announcement link specifically
    const announcementSection = html.substring(
      html.indexOf('href="/press"') - 200,
      html.indexOf('href="/press"') + 200
    );
    expect(announcementSection).toContain('aria-current="page"');
  });

  it("marks the roadmap page as current", () => {
    const html = renderToStaticMarkup(<SiteNav current="roadmap" />);

    const roadmapSection = html.substring(
      html.indexOf('href="/roadmap"') - 200,
      html.indexOf('href="/roadmap"') + 200
    );
    expect(roadmapSection).toContain('aria-current="page"');
  });

  it("marks the settings page as current", () => {
    const html = renderToStaticMarkup(<SiteNav current="settings" />);

    const settingsSection = html.substring(
      html.indexOf('href="/settings"') - 200,
      html.indexOf('href="/settings"') + 200
    );
    expect(settingsSection).toContain('aria-current="page"');
  });

  it("never marks the wordmark or GitHub as current", () => {
    const homeHtml = renderToStaticMarkup(<SiteNav current="home" />);

    // The wordmark link to "/" has no aria-current
    const wordmarkSection = homeHtml.substring(
      homeHtml.indexOf('aria-label="Second Thought home"') - 100,
      homeHtml.indexOf('aria-label="Second Thought home"') + 100
    );
    expect(wordmarkSection).not.toContain("aria-current");

    // GitHub never has aria-current
    expect(homeHtml).toContain("GitHub");
    const githubSection = homeHtml.substring(
      homeHtml.indexOf(
        'href="https://github.com/bharathts07/second-thought"'
      ) - 100,
      homeHtml.indexOf(
        'href="https://github.com/bharathts07/second-thought"'
      ) + 200
    );
    expect(githubSection).not.toContain("aria-current");
  });

  it("internal links have no icons", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    // Wordmark link - no svg
    const wordmarkSection = html.substring(
      html.indexOf('aria-label="Second Thought home"') - 100,
      html.indexOf('aria-label="Second Thought home"') + 100
    );
    expect(wordmarkSection).not.toContain("<svg");

    // Announcement link - no svg
    const announcementSection = html.substring(
      html.indexOf('href="/press"') - 100,
      html.indexOf('href="/press"') + 100
    );
    expect(announcementSection).not.toContain("<svg");

    // Roadmap link - no svg
    const roadmapSection = html.substring(
      html.indexOf('href="/roadmap"') - 100,
      html.indexOf('href="/roadmap"') + 100
    );
    expect(roadmapSection).not.toContain("<svg");

    // Settings link - no svg
    const settingsSection = html.substring(
      html.indexOf('href="/settings"') - 100,
      html.indexOf('href="/settings"') + 100
    );
    expect(settingsSection).not.toContain("<svg");
  });

  it("GitHub link has both icon marks and opens in new tab", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    // Extract the GitHub link section
    const githubSection = html.substring(
      html.indexOf('href="https://github.com/bharathts07/second-thought"') - 100,
      html.indexOf('href="https://github.com/bharathts07/second-thought"') + 1200
    );

    // Has target="_blank" with security attributes
    expect(githubSection).toContain('target="_blank"');
    expect(githubSection).toContain('rel="noopener noreferrer"');

    // Has accessible name mentioning new tab
    expect(githubSection).toContain('aria-label="GitHub (opens in new tab)"');

    // Has exactly 2 SVG elements (GitHub icon + external link arrow)
    const svgMatches = githubSection.match(/<svg/g);
    expect(svgMatches).toHaveLength(2);

    // Both SVGs are aria-hidden
    const ariaHiddenMatches = githubSection.match(/aria-hidden="true"/g);
    expect(ariaHiddenMatches).toHaveLength(2);
  });

  it("wraps at narrow widths via flex-wrap", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain("flex-wrap");
  });

  it("has gap between items for breathing room", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain("gap-x-");
    expect(html).toContain("gap-y-");
  });

  it("applies a bottom border to separate nav from content", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain("border-b");
  });
});
