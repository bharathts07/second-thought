import type { Metadata } from "next";
import "./globals.css";

/**
 * `metadataBase` is what makes the social-card URLs absolute. Without it Next emits
 * a relative `og:image`, which every scraper rejects, so a shared link renders as a
 * bare URL. It is the deployed origin rather than the preview one on purpose.
 *
 * There is deliberately no `og:image` file yet. An absent card degrades to title and
 * description, which is honest; a broken one is worse than none, and inventing a
 * screenshot here would go stale the next time the product surface changes.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://secondthought.work"),
  /*
   * A plain string, NOT a `{ default, template }` pair. `/press` sets its own full
   * title, `Second Thought · Press`, so a `%s · Second Thought` template would
   * render `Second Thought · Press · Second Thought` in the tab and in every shared
   * link. Child pages own their titles outright here.
   */
  title: "Second Thought",
  description:
    "A draft check that runs in your browser. Nothing you type is sent anywhere.",
  openGraph: {
    title: "Second Thought",
    description:
      "Know what you just promised, before you hit send. The check runs in your browser and nothing you type is sent anywhere.",
    url: "/",
    siteName: "Second Thought",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Second Thought",
    description:
      "Know what you just promised, before you hit send. The check runs in your browser and nothing you type is sent anywhere.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
