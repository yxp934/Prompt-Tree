import { estimateTokens } from "@/lib/utils/tokens";
import { generateUUID } from "@/lib/utils/uuid";
import type {
  ContextFileBlock,
  ContextFileKind,
  ContextImageFileBlock,
  ContextTextFileBlock,
  SupportedImageMime,
} from "@/types";

const DEFAULT_MAX_TEXT_CHARS = 60_000;

const SUPPORTED_IMAGE_MIME_TYPES: SupportedImageMime[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

function normalizeFilename(filename: string): string {
  const trimmed = filename.trim();
  return trimmed || "untitled";
}

function inferFileKind(file: File): ContextFileKind | null {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  if (type === "text/markdown" || name.endsWith(".md") || name.endsWith(".markdown")) {
    return "markdown";
  }

  if (type === "text/plain" || name.endsWith(".txt")) return "text";

  if (SUPPORTED_IMAGE_MIME_TYPES.includes(type as SupportedImageMime)) return "image";

  if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp")) {
    return "image";
  }

  return null;
}

function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  const normalized = text.replace(/\r\n/g, "\n");
  if (normalized.length <= maxChars) return { text: normalized, truncated: false };
  return { text: normalized.slice(0, maxChars), truncated: true };
}

async function readAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Invalid file read result."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
};

type PdfJsPage = {
  getTextContent: () => Promise<{ items?: unknown[] }>;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
};

type PdfJsModule = {
  getDocument: (src: { data: ArrayBuffer }) => PdfJsLoadingTask;
  GlobalWorkerOptions?: { workerSrc?: string };
};

function isPdfTextItem(item: unknown): item is { str: string } {
  if (typeof item !== "object" || item === null) return false;
  return "str" in item && typeof (item as { str?: unknown }).str === "string";
}

async function extractPdfText(
  file: File,
  maxChars: number,
): Promise<{ text: string; truncated: boolean }> {
  let pdfjs: PdfJsModule;
  try {
    pdfjs = (await import("pdfjs-dist/build/pdf")) as unknown as PdfJsModule;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new Error(`PDF support requires pdfjs-dist. (${detail})`);
  }

  // Let bundlers resolve the worker as a local asset when pdfjs-dist is installed.
  if (pdfjs.GlobalWorkerOptions) {
    try {
      const candidateUrls = [
        "pdfjs-dist/build/pdf.worker.min.mjs",
        "pdfjs-dist/build/pdf.worker.min.js",
      ];
      for (const candidate of candidateUrls) {
        try {
          pdfjs.GlobalWorkerOptions.workerSrc = new URL(candidate, import.meta.url).toString();
          break;
        } catch {
          // keep trying other candidates
        }
      }
    } catch {
      // ignore worker resolution failures; pdf.js will fallback to no worker in some environments
    }
  }

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  let out = "";
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items ?? [];
    const pageText = items
      .map((item) => (isPdfTextItem(item) ? item.str : ""))
      .filter(Boolean)
      .join(" ");

    if (pageText.trim()) {
      out += (out ? "\n\n" : "") + pageText;
      if (out.length >= maxChars) {
        out = out.slice(0, maxChars);
        truncated = true;
        break;
      }
    }
  }

  const normalized = out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  if (normalized.length <= maxChars) return { text: normalized, truncated };
  return { text: normalized.slice(0, maxChars), truncated: true };
}

export async function createContextFileBlock(
  file: File,
  options?: { maxChars?: number },
): Promise<ContextFileBlock> {
  const fileKind = inferFileKind(file);
  if (!fileKind) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  const id = generateUUID();
  const filename = normalizeFilename(file.name);
  const createdAt = Date.now();
  const maxChars = options?.maxChars ?? DEFAULT_MAX_TEXT_CHARS;

  if (fileKind === "image") {
    const mimeType = (() => {
      const type = (file.type || "").toLowerCase();
      if (SUPPORTED_IMAGE_MIME_TYPES.includes(type as SupportedImageMime)) {
        return type as SupportedImageMime;
      }
      // Extension-based fallback
      const lower = filename.toLowerCase();
      if (lower.endsWith(".png")) return "image/png";
      if (lower.endsWith(".webp")) return "image/webp";
      return "image/jpeg";
    })();

    const dataUrl = await readAsDataUrl(file);
    return {
      id,
      kind: "file",
      fileKind: "image",
      filename,
      mimeType,
      size: file.size,
      dataUrl,
      createdAt,
      tokenCount: 0,
    } satisfies ContextImageFileBlock;
  }

  const { text, truncated } =
    fileKind === "pdf"
      ? await extractPdfText(file, maxChars)
      : truncateText(await file.text(), maxChars);

  const tokenCount = estimateTokens(text);

  return {
    id,
    kind: "file",
    fileKind,
    filename,
    mimeType: file.type || "text/plain",
    content: text,
    truncated,
    createdAt,
    tokenCount,
  } satisfies ContextTextFileBlock;
}

export function getSupportedFileAcceptAttribute(): string {
  return [
    ".txt",
    ".md",
    ".markdown",
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
  ].join(",");
}
