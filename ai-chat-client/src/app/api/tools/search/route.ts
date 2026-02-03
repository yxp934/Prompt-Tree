import { NextResponse } from "next/server";

import { webSearch } from "@/lib/server/tools/webSearch";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const provider = body.provider === "exa" ? "exa" : "tavily";
  const apiKey = typeof body.apiKey === "string" ? body.apiKey : "";
  const query = typeof body.query === "string" ? body.query : "";
  const maxResults = typeof body.maxResults === "number" ? body.maxResults : 5;
  const searchDepth = body.searchDepth === "advanced" ? "advanced" : "basic";

  try {
    const result = await webSearch({
      provider,
      apiKey,
      query,
      maxResults,
      searchDepth,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

