import { NextResponse } from "next/server";

import {
  buildAuthHeaders,
  buildModelsUrl,
  createTimeoutController,
  parseProviderRequest,
} from "../utils";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseProviderRequest(body);

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { apiKey, baseUrl, headers, timeout } = parsed.data;
  const { signal, cancel } = createTimeoutController(timeout);

  try {
    const response = await fetch(buildModelsUrl(baseUrl), {
      method: "GET",
      headers: buildAuthHeaders(apiKey, headers),
      signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ models: [] });
      }

      const message =
        response.status === 401
          ? "API 密钥无效"
          : `HTTP ${response.status}: ${response.statusText}`;
      return NextResponse.json({ models: [], error: message });
    }

    const json = (await response.json().catch(() => null)) as
      | { data?: Array<{ id?: string; object?: string }>; models?: Array<{ id?: string; object?: string }> }
      | null;
    const rawModels = json?.data ?? json?.models ?? [];
    const models = rawModels
      .filter((model) => model && typeof model.id === "string")
      .map((model) => ({ id: model.id!, object: model.object }));

    return NextResponse.json({ models });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "请求超时"
        : err instanceof Error
          ? err.message
          : "未知错误";
    return NextResponse.json({ models: [], error: message });
  } finally {
    cancel();
  }
}
