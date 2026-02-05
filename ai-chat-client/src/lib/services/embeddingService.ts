import { buildModelSelectionKey } from "@/lib/services/providerModelService";
import { getPrimaryApiKey, type Provider, type ProviderModelSelection } from "@/types/provider";

type EmbedCallParams = {
  apiKey: string;
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  model: string;
  input: string | string[];
};

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export class EmbeddingService {
  private cache = new Map<string, number[]>();

  async embedWithSelection(params: {
    providers: Provider[];
    selection: ProviderModelSelection;
    text: string;
  }): Promise<{ embedding: number[]; embeddingModelKey: string } | null> {
    const text = normalizeText(params.text);
    if (!text) return null;

    const resolved = resolveProviderSelection(params.providers, params.selection);
    if (!resolved) return null;

    const embeddingModelKey = buildModelSelectionKey(params.selection);
    const cached = this.cache.get(`${embeddingModelKey}:${text}`);
    if (cached) return { embedding: cached, embeddingModelKey };

    const result = await this.embed({
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      headers: resolved.headers,
      timeout: resolved.timeout,
      model: params.selection.modelId,
      input: text,
    });

    if (!result?.[0]) return null;
    this.cache.set(`${embeddingModelKey}:${text}`, result[0]);
    return { embedding: result[0], embeddingModelKey };
  }

  async embedBatchWithSelection(params: {
    providers: Provider[];
    selection: ProviderModelSelection;
    texts: string[];
  }): Promise<{ embeddings: number[][]; embeddingModelKey: string } | null> {
    const texts = params.texts.map(normalizeText).filter(Boolean);
    if (texts.length === 0) return null;

    const resolved = resolveProviderSelection(params.providers, params.selection);
    if (!resolved) return null;

    const embeddingModelKey = buildModelSelectionKey(params.selection);
    const missing: Array<{ index: number; text: string }> = [];
    const out: number[][] = new Array(texts.length);

    for (const [index, text] of texts.entries()) {
      const cached = this.cache.get(`${embeddingModelKey}:${text}`);
      if (cached) out[index] = cached;
      else missing.push({ index, text });
    }

    if (missing.length > 0) {
      const res = await this.embed({
        apiKey: resolved.apiKey,
        baseUrl: resolved.baseUrl,
        headers: resolved.headers,
        timeout: resolved.timeout,
        model: params.selection.modelId,
        input: missing.map((m) => m.text),
      });
      if (!res || res.length !== missing.length) return null;
      for (const [i, item] of missing.entries()) {
        const emb = res[i];
        if (!emb) continue;
        out[item.index] = emb;
        this.cache.set(`${embeddingModelKey}:${item.text}`, emb);
      }
    }

    if (out.some((e) => !Array.isArray(e) || e.length === 0)) return null;
    return { embeddings: out, embeddingModelKey };
  }

  private async embed(params: EmbedCallParams): Promise<number[][] | null> {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: params.apiKey,
        baseUrl: normalizeBaseUrl(params.baseUrl),
        headers: params.headers,
        timeout: params.timeout,
        model: params.model,
        input: params.input,
      }),
    });

    if (!response.ok) return null;
    const json = (await response.json().catch(() => null)) as
      | { embeddings?: unknown }
      | null;
    const embeddings = json && Array.isArray(json.embeddings) ? json.embeddings : null;
    if (!embeddings || !embeddings.every((e) => Array.isArray(e) && e.every((n) => typeof n === "number"))) {
      return null;
    }
    return embeddings as number[][];
  }
}

function resolveProviderSelection(
  providers: Provider[],
  selection: ProviderModelSelection,
): { apiKey: string; baseUrl: string; headers?: Record<string, string>; timeout?: number } | null {
  const provider = providers.find((p) => p.id === selection.providerId) ?? null;
  if (!provider) return null;
  const key = getPrimaryApiKey(provider);
  if (!key) return null;
  return {
    apiKey: key.value,
    baseUrl: provider.baseUrl,
    headers: provider.headers,
    timeout: provider.timeout,
  };
}

