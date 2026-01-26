import { NextResponse } from "next/server";

import {
  buildAuthHeaders,
  buildChatCompletionsUrl,
  createTimeoutController,
  parseProviderRequest,
} from "../utils";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseProviderRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const payload = body as { model?: unknown; prompt?: unknown };
  const model =
    typeof payload.model === "string" && payload.model.trim()
      ? payload.model.trim()
      : "gpt-3.5-turbo";
  const prompt =
    typeof payload.prompt === "string" && payload.prompt.trim()
      ? payload.prompt.trim()
      : "hi";

  const { apiKey, baseUrl, headers, timeout } = parsed.data;
  const { signal, cancel } = createTimeoutController(timeout);
  const startTime = Date.now();

  try {
    const response = await fetch(buildChatCompletionsUrl(baseUrl), {
      method: "POST",
      headers: buildAuthHeaders(apiKey, headers),
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4,
      }),
      signal,
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const message =
        response.status === 401
          ? "API 密钥无效"
          : `HTTP ${response.status}: ${response.statusText}`;
      return NextResponse.json({ status: "error", error: message, responseTime });
    }

    const json = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
    const content = json?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ status: "healthy", responseTime, content });
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "请求超时"
        : err instanceof Error
          ? err.message
          : "未知错误";
    return NextResponse.json({ status: "error", error: message, responseTime });
  } finally {
    cancel();
  }
}
