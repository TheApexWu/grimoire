import type { Metadata } from "next";
import { EB_Garamond, Martian_Mono, Manrope } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const heading = EB_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const mono = Martian_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const body = Manrope({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Grimoire - Agentic Writing Workshop",
  description:
    "Capture any writing voice. Study it. Channel it. An agentic writing workshop that makes invisible craft visible.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${mono.variable} ${body.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-black text-zinc-100 font-[family-name:var(--font-geist-sans)]">
        <ClerkProvider appearance={{
          variables: { colorPrimary: "#fff", colorBackground: "#09090b", colorText: "#f4f4f5" },
        }}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
