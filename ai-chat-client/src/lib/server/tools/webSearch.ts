export type WebSearchProvider = "tavily" | "exa";

export interface WebSearchParams {
  provider: WebSearchProvider;
  apiKey: string;
  query: string;
  maxResults: number;
  searchDepth?: "basic" | "advanced";
}

export interface WebSearchResult {
  id: number;
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  provider: WebSearchProvider;
  query: string;
  results: WebSearchResult[];
  sources: Array<{ id: number; title: string; url: string }>;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeUrl(value: unknown): string {
  const raw = normalizeText(value).trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function toResults(items: Array<{ title: string; url: string; snippet: string }>): WebSearchResult[] {
  return items.map((item, index) => ({
    id: index + 1,
    title: item.title,
    url: item.url,
    snippet: item.snippet,
  }));
}

async function searchTavily(params: WebSearchParams): Promise<WebSearchResponse> {
  const query = params.query.trim();
  const maxResults = clampInt(params.maxResults, 1, 20);
  const searchDepth = params.searchDepth === "advanced" ? "advanced" : "basic";

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: searchDepth,
      max_results: maxResults,
      include_answer: false,
      include_images: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Tavily error (${response.status}): ${text || response.statusText}`);
  }

  const json = (await response.json().catch(() => null)) as
    | {
        results?: Array<{ title?: unknown; url?: unknown; content?: unknown }>;
      }
    | null;

  const rawResults = Array.isArray(json?.results) ? json!.results : [];
  const mapped = rawResults
    .map((r) => ({
      title: normalizeText(r.title).trim(),
      url: normalizeUrl(r.url),
      snippet: normalizeText(r.content).trim(),
    }))
    .filter((r) => r.title && r.url);

  const results = toResults(mapped);
  return {
    provider: "tavily",
    query,
    results,
    sources: results.map((r) => ({ id: r.id, title: r.title, url: r.url })),
  };
}

async function searchExa(params: WebSearchParams): Promise<WebSearchResponse> {
  const query = params.query.trim();
  const maxResults = clampInt(params.maxResults, 1, 20);

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
    },
    body: JSON.stringify({
      query,
      numResults: maxResults,
      contents: {
        text: false,
        highlights: { numSentences: 3, query },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Exa error (${response.status}): ${text || response.statusText}`);
  }

  const json = (await response.json().catch(() => null)) as
    | {
        results?: Array<{
          title?: unknown;
          url?: unknown;
          text?: unknown;
          highlights?: unknown;
        }>;
      }
    | null;

  const rawResults = Array.isArray(json?.results) ? json!.results : [];
  const mapped = rawResults
    .map((r) => {
      const highlights = r.highlights;
      const highlightText = Array.isArray(highlights)
        ? highlights.filter((x): x is string => typeof x === "string").join("\n")
        : normalizeText(highlights);

      const text = normalizeText(r.text);
      const snippet = (highlightText || text).trim();

      return {
        title: normalizeText(r.title).trim(),
        url: normalizeUrl(r.url),
        snippet,
      };
    })
    .filter((r) => r.title && r.url);

  const results = toResults(mapped);
  return {
    provider: "exa",
    query,
    results,
    sources: results.map((r) => ({ id: r.id, title: r.title, url: r.url })),
  };
}

export async function webSearch(params: WebSearchParams): Promise<WebSearchResponse> {
  if (!params.apiKey.trim()) {
    throw new Error("Missing search API key.");
  }
  if (!params.query.trim()) {
    throw new Error("Missing search query.");
  }

  if (params.provider === "exa") return searchExa(params);
  return searchTavily(params);
}

