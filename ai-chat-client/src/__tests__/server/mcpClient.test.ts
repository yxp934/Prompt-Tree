import { describe, expect, it, vi } from "vitest";

import { mcpListTools, mcpTestListTools } from "@/lib/server/mcp/mcpClient";
import type { MCPServerEntry } from "@/types";

describe("mcpClient", () => {
  it("throws a readable error for invalid configJson", async () => {
    const server: MCPServerEntry = {
      id: "mcp_bad",
      name: "Bad MCP",
      transport: "http",
      token: "",
      configJson: "{",
      createdAt: 1,
      updatedAt: 1,
    };

    await expect(mcpListTools(server)).rejects.toThrow(/Invalid MCP configJson/);
  });

  it("accepts Claude-style { mcpServers: { ... } } configJson by unwrapping matching server", async () => {
    const server: MCPServerEntry = {
      id: "sequential-thinking",
      name: "Sequential Thinking",
      transport: "http",
      token: "",
      configJson: JSON.stringify(
        {
          mcpServers: {
            "sequential-thinking": {
              url: "http://example.com/mcp",
              protocolVersion: "2024-11-05",
            },
          },
        },
        null,
        2,
      ),
      createdAt: 1,
      updatedAt: 1,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toBe("http://example.com/mcp");

      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const method = body?.method as string | undefined;

      if (method === "initialize") {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { capabilities: {} } }),
          { status: 200, headers: { "Content-Type": "application/json", "mcp-session-id": "sid_1" } },
        );
      }

      if (method === "notifications/initialized") {
        return new Response("", { status: 200 });
      }

      if (method === "tools/list") {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [] } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("unexpected", { status: 400 });
    });

    const prevFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    try {
      const result = await mcpListTools(server);
      expect(result.tools).toEqual([]);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = prevFetch;
    }
  });

  it('accepts single-key wrapper { "<id>": { ... } } configJson by unwrapping', async () => {
    const server: MCPServerEntry = {
      id: "sequential-thinking",
      name: "Sequential Thinking",
      transport: "http",
      token: "",
      configJson: JSON.stringify(
        {
          "sequential-thinking": {
            url: "http://example.com/mcp",
            protocolVersion: "2024-11-05",
          },
        },
        null,
        2,
      ),
      createdAt: 1,
      updatedAt: 1,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      expect(url).toBe("http://example.com/mcp");

      const body = init?.body ? JSON.parse(String(init.body)) : null;
      const method = body?.method as string | undefined;

      if (method === "initialize") {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { capabilities: {} } }),
          { status: 200, headers: { "Content-Type": "application/json", "mcp-session-id": "sid_1" } },
        );
      }

      if (method === "notifications/initialized") {
        return new Response("", { status: 200 });
      }

      if (method === "tools/list") {
        return new Response(
          JSON.stringify({ jsonrpc: "2.0", id: body.id, result: { tools: [] } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response("unexpected", { status: 400 });
    });

    const prevFetch = globalThis.fetch;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = fetchMock;
    try {
      const result = await mcpListTools(server);
      expect(result.tools).toEqual([]);
      expect(fetchMock).toHaveBeenCalled();
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).fetch = prevFetch;
    }
  });

  it("defaults stdio framing to newline during test connection", async () => {
    const serverCode = `
      const readline = require("node:readline");

      const rl = readline.createInterface({ input: process.stdin });
      rl.on("line", (line) => {
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          return;
        }
        if (!msg || msg.jsonrpc !== "2.0") return;

        if (msg.method === "initialize" && msg.id != null) {
          process.stdout.write(
            JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { capabilities: {} } }) + "\\n",
          );
          return;
        }

        if (msg.method === "tools/list" && msg.id != null) {
          process.stdout.write(
            JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { tools: [] } }) + "\\n",
          );
        }
      });
    `;

    const server: MCPServerEntry = {
      id: "fake_newline",
      name: "Fake Newline MCP",
      transport: "stdio",
      token: "",
      configJson: JSON.stringify(
        {
          command: process.execPath,
          args: ["-e", serverCode],
          requestTimeoutMs: 2000,
        },
        null,
        2,
      ),
      createdAt: 1,
      updatedAt: 1,
    };

    const result = await mcpTestListTools(server);
    expect(result.tools).toEqual([]);
  });
});
