import { NextResponse } from "next/server";

import { mcpTestListTools, type McpLogEvent } from "@/lib/server/mcp/mcpClient";
import type { MCPServerEntry } from "@/types";

export const runtime = "nodejs";

type McpTestStreamEvent =
  | { type: "status"; phase: string }
  | { type: "log"; stream: "stdout" | "stderr"; text: string }
  | {
      type: "result";
      latencyMs: number;
      tools: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    }
  | { type: "error"; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ type: "error", message: "Unserializable payload." } satisfies McpTestStreamEvent);
  }
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

  const encoder = new TextEncoder();
  const streamBody = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: McpTestStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${safeJsonStringify(event)}\n\n`));
      };
      const done = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      void (async () => {
        const startedAt = Date.now();
        try {
          send({ type: "status", phase: "starting" });

          const result = await mcpTestListTools(server, (log: McpLogEvent) => {
            send({ type: "log", stream: log.stream, text: log.text });
          });

          send({
            type: "result",
            latencyMs: Math.max(0, Date.now() - startedAt),
            tools: result.tools,
          });
        } catch (err) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : "MCP test failed",
          });
        } finally {
          done();
          controller.close();
        }
      })();
    },
  });

  return new Response(streamBody, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

