import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { ChatProvider } from "@/contexts/ChatContext";
import { GuestSessionProvider } from "@/contexts/GuestSessionContext";
import { Toaster } from "@/components/ui/toaster";
import { Suspense } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealTime Chat - Connect Instantly",
  description:
    "Real-time chat application with video calling and random user matching",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased">
        <Suspense fallback={null}>
          <GuestSessionProvider>
            <ChatProvider>
              {children}
              <Toaster />
            </ChatProvider>
          </GuestSessionProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
