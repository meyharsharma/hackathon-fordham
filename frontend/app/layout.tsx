import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "codescan",
  description:
    "Documentation generator for legacy codebases. Five AG2 agents over IBM NLIP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="relative min-h-screen overflow-x-hidden">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
