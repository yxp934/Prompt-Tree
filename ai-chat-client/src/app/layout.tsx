import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
