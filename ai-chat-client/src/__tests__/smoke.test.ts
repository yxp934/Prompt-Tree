import { describe, expect, it } from "vitest";

describe("test setup", () => {
  it("provides indexedDB in the test environment", () => {
    expect(indexedDB).toBeDefined();
  });
});

