import type { AgentStreamEvent, ChatMessage, ToolSettings, ToolUseId } from "@/types";

export interface AgentRunParams {
  apiKey: string;
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  model: string;
  temperature: number;
  maxTokens: number;
  messages: ChatMessage[];
  toolUses: ToolUseId[];
  toolSettings: ToolSettings;
  stream?: boolean;
  onEvent?: (event: AgentStreamEvent) => void;
}

export interface AgentRunResult {
  content: string;
}

export interface IAgentService {
  run(params: AgentRunParams): Promise<AgentRunResult>;
}

export class AgentService implements IAgentService {
  async run(params: AgentRunParams): Promise<AgentRunResult> {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Agent request failed (${response.status}): ${text}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.body || contentType.includes("application/json")) {
      const json = (await response.json().catch(() => null)) as unknown;
      if (
        typeof json === "object" &&
        json !== null &&
        "content" in json &&
        typeof (json as { content: unknown }).content === "string"
      ) {
        return { content: (json as { content: string }).content };
      }
      throw new Error("Invalid agent response payload.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let content = "";
    let done = false;

    while (!done) {
      const result = await reader.read();
      if (result.done) break;

      buffer += decoder.decode(result.value, { stream: true });
      const parts = buffer.split(/\r?\n\r?\n/);
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split(/\r?\n/);
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.replace(/^data:\s*/, "");
          if (!data) continue;
          if (data === "[DONE]") {
            done = true;
            break;
          }
          try {
            const event = JSON.parse(data) as AgentStreamEvent;
            params.onEvent?.(event);
            if (event.type === "assistant_delta") {
              content += event.delta;
            } else if (event.type === "assistant_final") {
              content = event.content;
            }
          } catch {
            // ignore malformed stream payloads
          }
        }
        if (done) break;
      }
    }

    return { content };
  }
}

