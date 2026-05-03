import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "hax — field notes on legacy code",
  description:
    "Documentation generator for legacy codebases. Five AG2 agents over IBM NLIP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative min-h-screen">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
