import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Layout for the roadmap route. Sets page metadata since roadmap/page.tsx
 * may be a client component and cannot export metadata itself.
 */
export const metadata: Metadata = {
  title: "Second Thought · Roadmap",
  description:
    "What downloads, model details, and current status. " +
    "What ships today and what is still being built.",
};

export default function RoadmapLayout({ children }: { children: ReactNode }) {
  return children;
}
