import { describe, expect, it } from "vitest";

import { normalizeBaseUrl } from "@/lib/services/providerApiService";

describe("providerApiService", () => {
  it("removes endpoint suffixes and trailing slashes", () => {
    expect(normalizeBaseUrl(" https://example.com/v1/chat/completions/ ")).toBe(
      "https://example.com/v1",
    );
    expect(normalizeBaseUrl("https://example.com/v1/models/")).toBe(
      "https://example.com/v1",
    );
  });

  it("keeps plain host URL unchanged", () => {
    expect(normalizeBaseUrl("https://api.openai.com")).toBe(
      "https://api.openai.com",
    );
  });
});
