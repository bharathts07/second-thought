import type { Metadata } from "next";

export const metadata: Metadata = {
  /**
   * `Second Thought · Privacy`, matching every other route.
   *
   * This shipped as "Privacy - Second Thought", which both reversed the order and
   * swapped the separator, so with several tabs open this one did not look like it
   * belonged to the same site. The other four are `Second Thought · Announcement`,
   * `· Settings`, `· Roadmap` and the bare wordmark on the product page.
   */
  title: "Second Thought · Privacy",
  description:
    "What Second Thought does with what you type, where it goes, and who can see it. " +
    "Nothing you type leaves your machine.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
