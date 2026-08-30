import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Second Thought",
  description: "A draft check that runs in your browser. Nothing you type is sent anywhere.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
