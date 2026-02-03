import type { Metadata } from "next";
import "./globals.css";

import ClientGlobals from "@/components/layout/ClientGlobals";

// 元数据配置
export const metadata: Metadata = {
  title: "Prompt Tree - AI Dialogue Topology",
  description:
    "A visual dialogue tree interface for AI conversations with context management and token optimization.",
  keywords: ["AI", "dialogue", "chat", "context", "topology", "tree"],
  authors: [{ name: "Prompt Tree Team" }],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClientGlobals />
        {children}
      </body>
    </html>
  );
}
