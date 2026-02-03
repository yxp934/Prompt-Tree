import { NextResponse } from "next/server";

import { mcpCallTool } from "@/lib/server/mcp/mcpClient";
import type { MCPServerEntry } from "@/types";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseServer(value: unknown): MCPServerEntry | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : "";
  const name = typeof value.name === "string" ? value.name : "";
  const transport =
    value.transport === "stdio" || value.transport === "sse" ? value.transport : "http";
  const token = typeof value.token === "string" ? value.token : "";
  const configJson = typeof value.configJson === "string" ? value.configJson : "";
  const createdAt = typeof value.createdAt === "number" ? value.createdAt : Date.now();
  const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : Date.now();
  if (!id.trim() || !name.trim()) return null;
  return { id, name, transport, token, configJson, createdAt, updatedAt };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const server = parseServer(body.server);
  if (!server) {
    return NextResponse.json({ error: "Missing MCP server config." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Missing tool name." }, { status: 400 });
  }

  try {
    const result = await mcpCallTool(server, name, body.arguments);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "MCP callTool failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

