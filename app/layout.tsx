import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Body Intelligence",
    template: "%s · Body Intelligence",
  },
  description:
    "Personal health intelligence for athletes — track training, sleep, nutrition, and let Claude reason over the data through MCP.",
  applicationName: "Body Intelligence",
  authors: [{ name: "Body Intelligence" }],
  openGraph: {
    title: "Body Intelligence",
    description:
      "Capture the data. Let Claude do the reasoning. A passive store for workouts, sleep, meals, and a markdown memory layer.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  // App is pinned to the light palette (see the `light` class on <html>), so the
  // browser chrome color is white regardless of the OS setting.
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // `light` pins the app to the :root light palette. The dark palette only
      // applies via `@media (prefers-color-scheme: dark) { :root:not(.light) }`
      // and there is no `.dark` class anywhere, so this forces white everywhere.
      className={`${geistSans.variable} ${geistMono.variable} light h-full antialiased`}
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        {children}
      </body>
    </html>
  );
}
