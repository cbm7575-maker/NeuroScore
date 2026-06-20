import type { Metadata } from "next";
import "./globals.css";
import TabNav from "@/components/tab-nav";

export const metadata: Metadata = {
  title: "NeuroScore",
  description: "Predict neural engagement before publishing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <header className="border-b border-[var(--border)] px-6 py-4">
          <h1 className="text-xl font-semibold tracking-tight">NeuroScore</h1>
        </header>
        <TabNav />
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
