import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The route needs its own title, and `settings/page.tsx` is a client component,
 * so it cannot export metadata itself. Without this the page inherited the
 * generic root title while /press set its own, which reads as an unfinished
 * route to anyone with several tabs open.
 */
export const metadata: Metadata = {
  title: "Second Thought · Rules",
  description:
    "Every rule this checker applies, with the wording it looks for and the contexts it applies in.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
