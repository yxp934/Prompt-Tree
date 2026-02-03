import { describe, expect, it } from "vitest";

import { stripModelThinkingTags } from "@/lib/services/messageContentService";

describe("stripModelThinkingTags", () => {
  it("removes <think> blocks and returns visible text", () => {
    const input = "Hello<think>secret</think>world";
    const result = stripModelThinkingTags(input);
    expect(result.visible).toBe("Helloworld");
    expect(result.thinkingBlocks).toEqual(["secret"]);
  });

  it("removes unfinished thinking blocks to end of message", () => {
    const input = "Visible\n<think>\nsecret";
    const result = stripModelThinkingTags(input);
    expect(result.visible).toBe("Visible\n");
    expect(result.thinkingBlocks).toEqual(["\nsecret"]);
  });

  it("keeps tags inside fenced code blocks", () => {
    const input = [
      "Before",
      "```xml",
      "<think>keep</think>",
      "```",
      "After<think>hide</think>done",
    ].join("\n");
    const result = stripModelThinkingTags(input);
    expect(result.visible).toBe(
      ["Before", "```xml", "<think>keep</think>", "```", "Afterdone"].join("\n"),
    );
    expect(result.thinkingBlocks).toEqual(["hide"]);
  });

  it("removes stray closing tags", () => {
    const input = "Hello</think>world";
    const result = stripModelThinkingTags(input);
    expect(result.visible).toBe("Helloworld");
    expect(result.thinkingBlocks).toEqual([]);
  });
});

