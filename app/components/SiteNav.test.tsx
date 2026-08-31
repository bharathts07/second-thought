import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SiteNav } from "./SiteNav";

describe("SiteNav", () => {
  it("renders all six destinations", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    // Wordmark
    expect(html).toContain("Second Thought");
    expect(html).toContain('href="/"');

    // Main nav links
    expect(html).toContain("Announcement");
    expect(html).toContain('href="/press"');
    expect(html).toContain("Roadmap");
    expect(html).toContain('href="/roadmap"');
    expect(html).toContain("Privacy");
    expect(html).toContain('href="/privacy"');
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

  it("marks the privacy page as current", () => {
    const html = renderToStaticMarkup(<SiteNav current="privacy" />);

    const privacySection = html.substring(
      html.indexOf('href="/privacy"') - 200,
      html.indexOf('href="/privacy"') + 200
    );
    expect(privacySection).toContain('aria-current="page"');
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

  it("includes exactly one svg in the nav (the gear icon)", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    const svgMatches = html.match(/<svg/g);
    expect(svgMatches).toHaveLength(1);
  });

  it("marks the gear icon as aria-hidden", () => {
    const html = renderToStaticMarkup(<SiteNav current="settings" />);

    expect(html).toContain("<svg");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders the gear icon before the Settings label", () => {
    const html = renderToStaticMarkup(<SiteNav current="settings" />);

    const settingsLinkStart = html.indexOf('href="/settings"');
    const svgPosition = html.indexOf("<svg");
    const settingsTextPosition = html.indexOf("Settings", settingsLinkStart);

    expect(svgPosition).toBeGreaterThan(settingsLinkStart);
    expect(svgPosition).toBeLessThan(settingsTextPosition);
  });

  it("applies currentColor to the gear icon", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain('stroke="currentColor"');
  });

  it("uses hairline stroke (1px) on the gear icon", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain('stroke-width="1"');
  });

  it("has no fill on the gear icon", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain('fill="none"');
  });

  it("GitHub link opens in a new tab with security attributes", () => {
    const html = renderToStaticMarkup(<SiteNav current="home" />);

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
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
