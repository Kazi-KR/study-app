import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

// Inter is the de-facto modern UI font for product interfaces (Linear,
// Vercel, GitHub Primer, Stripe). Self-hosted via next/font so there's no
// extra request to Google at runtime and no CLS. Exposed as a CSS variable
// so globals.css can reference it.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Writing Study",
  description: "A short writing study",
};

// Runs synchronously before React hydrates. Applies `class="dark"` on <html>
// based on (a) an explicit user choice stored in localStorage, or (b) the
// browser's system preference. Without this the page would paint in light
// theme first and then flash to dark, which is jarring.
const THEME_BOOT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var useDark = saved === 'dark' || (saved == null && prefersDark);
    if (useDark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the boot script mutates `<html>` class before
    // React hydrates, so the server-rendered HTML won't match. That's expected.
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
