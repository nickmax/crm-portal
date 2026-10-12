import React from "react";
import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { CrmProvider } from "@/lib/crm/store";
import { AuthProvider } from "@/lib/crm/auth";
import { CrmShell } from "@/components/crm/shell";

const instrumentSans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-instrument-serif" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: { default: "BDP CRM — Mathenge Inc.", template: "%s | BDP CRM" },
  description: "The operating system for the Mathenge Inc. BDP sales network: leads, pipeline, meetings, deals and commissions.",
  icons: { icon: "/brand/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <CrmProvider>
            <div className="relative min-h-screen noise-overlay">
              <CrmShell>{children}</CrmShell>
            </div>
          </CrmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
