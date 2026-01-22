import type { Metadata } from "next";
import { Instrument_Serif, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// 配置字体
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

// 元数据配置
export const metadata: Metadata = {
  title: "Cortex - AI Dialogue Topology",
  description:
    "A visual dialogue tree interface for AI conversations with context management and token optimization.",
  keywords: ["AI", "dialogue", "chat", "context", "topology", "tree"],
  authors: [{ name: "Cortex Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${instrumentSerif.variable} ${dmSans.variable} ${ibmPlexMono.variable} antialiased`}
        style={{
          // 覆盖 CSS 变量以使用 Next.js 字体
          // @ts-expect-error CSS custom properties
          "--font-display": "var(--font-instrument-serif), Georgia, serif",
          "--font-body": "var(--font-dm-sans), -apple-system, sans-serif",
          "--font-mono": "var(--font-ibm-plex-mono), monospace",
        }}
      >
        {children}
      </body>
    </html>
  );
}
