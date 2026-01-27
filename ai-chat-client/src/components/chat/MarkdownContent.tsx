"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children, ...props }) => (
          <p className="whitespace-pre-wrap" {...props}>
            {children}
          </p>
        ),
        li: ({ children, ...props }) => (
          <li className="whitespace-pre-wrap" {...props}>
            {children}
          </li>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
