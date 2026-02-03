export interface StrippedThinkingResult {
  visible: string;
  thinkingBlocks: string[];
}

const THINKING_TAG_NAMES = [
  "think",
  "analysis",
  "reasoning",
  "thinking",
  "thought",
  "thoughts",
] as const;

const OPEN_THINKING_TAG_REGEX = new RegExp(
  `<\\s*(${THINKING_TAG_NAMES.join("|")})\\b[^>]*>`,
  "gi",
);

function stripThinkingBlocksFromText(text: string): StrippedThinkingResult {
  const thinkingBlocks: string[] = [];
  let visible = "";
  let cursor = 0;

  while (true) {
    OPEN_THINKING_TAG_REGEX.lastIndex = cursor;
    const open = OPEN_THINKING_TAG_REGEX.exec(text);
    if (!open) break;

    const openIndex = open.index;
    const openEnd = openIndex + open[0].length;
    const tagName = (open[1] ?? "").toLowerCase();

    visible += text.slice(cursor, openIndex);

    const closeRegex = new RegExp(`</\\s*${tagName}\\s*>`, "gi");
    closeRegex.lastIndex = openEnd;
    const close = closeRegex.exec(text);

    if (!close) {
      thinkingBlocks.push(text.slice(openEnd));
      cursor = text.length;
      break;
    }

    thinkingBlocks.push(text.slice(openEnd, close.index));
    cursor = close.index + close[0].length;
  }

  visible += text.slice(cursor);

  // Remove stray closing tags without a matching open tag.
  visible = visible.replace(
    new RegExp(`</\\s*(${THINKING_TAG_NAMES.join("|")})\\s*>`, "gi"),
    "",
  );

  return { visible, thinkingBlocks };
}

function stripThinkingBlocksPreservingCodeFences(content: string): StrippedThinkingResult {
  const lines = content.split(/\r?\n/);
  const visibleParts: string[] = [];
  const thinkingBlocks: string[] = [];
  let inFence = false;
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.join("\n");
    buffer = [];
    const stripped = stripThinkingBlocksFromText(text);
    visibleParts.push(stripped.visible);
    thinkingBlocks.push(...stripped.thinkingBlocks);
  };

  for (const line of lines) {
    const isFenceMarker = line.trimStart().startsWith("```");
    if (isFenceMarker) {
      if (!inFence) flush();
      inFence = !inFence;
      visibleParts.push(line);
      continue;
    }

    if (inFence) {
      visibleParts.push(line);
      continue;
    }

    buffer.push(line);
  }

  flush();

  return { visible: visibleParts.join("\n"), thinkingBlocks };
}

export function stripModelThinkingTags(content: string): StrippedThinkingResult {
  return stripThinkingBlocksPreservingCodeFences(content);
}

