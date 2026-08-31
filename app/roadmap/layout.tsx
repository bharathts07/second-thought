import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Layout for the roadmap route. Sets page metadata since roadmap/page.tsx
 * may be a client component and cannot export metadata itself.
 */
export const metadata: Metadata = {
  title: "Second Thought · Roadmap",
  description: "Status, capabilities, and technical detail.",
};

export default function RoadmapLayout({ children }: { children: ReactNode }) {
  return children;
}
