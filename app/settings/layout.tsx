import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The route needs its own title, and `settings/page.tsx` is a client component,
 * so it cannot export metadata itself. Without this the page inherited the
 * generic root title while /press set its own, which reads as an unfinished
 * route to anyone with several tabs open.
 */
export const metadata: Metadata = {
  title: "Second Thought · Settings",
  description:
    "Every rule this check applies, covering what you can promise, what you can share, and how you talk to people. Read and disable any of them.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
