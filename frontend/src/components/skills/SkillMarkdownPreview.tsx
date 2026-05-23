"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type SkillMarkdownPreviewProps = {
  content: string;
  variant?: "card" | "detail";
  emptyLabel?: string;
};

export function SkillMarkdownPreview({
  content,
  variant = "detail",
  emptyLabel = "No description available",
}: SkillMarkdownPreviewProps) {
  const trimmed = content.trim();

  return (
    <div
      className={cn(
        "skill-markdown-preview overflow-hidden rounded-lg border border-border bg-card",
        variant === "card" && "skill-markdown-preview--card h-[168px] p-3 [mask-image:linear-gradient(180deg,#000_70%,transparent_100%)]",
        variant === "detail" && "p-5",
      )}
    >
      {trimmed ? (
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="mb-2 text-xs leading-relaxed text-muted-foreground last:mb-0">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="mb-2 ml-4 list-disc text-xs text-muted-foreground">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-2 ml-4 list-decimal text-xs text-muted-foreground">{children}</ol>
            ),
          }}
        >
          {trimmed}
        </ReactMarkdown>
      ) : (
        <p className="skill-markdown-empty m-0 text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
