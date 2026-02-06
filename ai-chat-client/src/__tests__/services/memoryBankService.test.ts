import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteDB } from "@/lib/db/indexedDB";
import { MemoryBankService } from "@/lib/services/memoryBankService";

describe("MemoryBankService", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await deleteDB();
  });

  it("filters search results by updatedAt using timeFrom/timeTo", async () => {
    let now = 0;
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);
    const service = new MemoryBankService();

    now = Date.parse("2026-01-01T00:00:00.000Z");
    const m1 = await service.upsert({
      item: { text: "alpha one", tags: ["alpha"], scope: "user" },
    });

    now = Date.parse("2026-01-02T00:00:00.000Z");
    const m2 = await service.upsert({
      item: { text: "alpha two", tags: ["alpha"], scope: "user" },
    });
    nowSpy.mockRestore();

    const all = await service.search({ query: "alpha", topK: 10, scope: "user" });
    expect(all.map((m) => m.id)).toEqual([m2.id, m1.id]);

    const onlySecond = await service.search({
      query: "alpha",
      topK: 10,
      scope: "user",
      timeFrom: m2.updatedAt,
    });
    expect(onlySecond.map((m) => m.id)).toEqual([m2.id]);

    const onlyFirst = await service.search({
      query: "alpha",
      topK: 10,
      scope: "user",
      timeTo: m1.updatedAt,
    });
    expect(onlyFirst.map((m) => m.id)).toEqual([m1.id]);

    const swapped = await service.search({
      query: "alpha",
      topK: 10,
      scope: "user",
      timeFrom: m2.updatedAt,
      timeTo: m1.updatedAt,
    });
    expect(swapped.map((m) => m.id)).toEqual([m2.id, m1.id]);
  });

  it("loads existing memory items by id", async () => {
    const service = new MemoryBankService();
    const m1 = await service.upsert({
      item: { text: "memory one", tags: ["one"], scope: "user" },
    });
    const m2 = await service.upsert({
      item: { text: "memory two", tags: ["two"], scope: "user" },
    });

    const list = await service.getByIds([m2.id, "missing-id", m1.id, m2.id]);
    expect(list.map((item) => item.id)).toEqual([m2.id, m1.id]);
  });
});
