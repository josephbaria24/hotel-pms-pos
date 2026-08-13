import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppProviders } from "@/components/providers/AppProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "PalawanSU Hotel",
  description: "Hotel Property Management System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          <AppProviders>{children}</AppProviders>
        </Suspense>
      </body>
    </html>
  );
}
