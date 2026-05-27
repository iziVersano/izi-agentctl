import type { Metadata } from "next";
import { Space_Mono, Rajdhani } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rajdhani",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AGENTCTL",
  description: "Agent dashboard for managing GitHub repos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} ${rajdhani.variable}`}
    >
      <body className="min-h-dvh bg-term-bg font-mono text-term-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
