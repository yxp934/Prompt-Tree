import type { MemoryWriterPlan, MemoryUpsertInput, JsonPatchOp } from "@/types";

function extractJsonCandidate(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const candidate = fenced[1].trim();
    if (candidate) return candidate;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

export function safeParseMemoryWriterPlan(text: string): MemoryWriterPlan {
  const candidate = extractJsonCandidate(text);
  if (!candidate) throw new Error("Memory writer returned empty JSON payload.");

  let raw: unknown;
  try {
    raw = JSON.parse(candidate) as unknown;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown JSON parse error";
    throw new Error(`Failed to parse memory writer JSON: ${message}`);
  }

  return normalizePlan(raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePatchOps(value: unknown): JsonPatchOp[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ops: JsonPatchOp[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const op = item.op;
    const path = typeof item.path === "string" ? item.path : "";
    if (!path.trim()) continue;

    if (op === "set" && "value" in item) {
      ops.push({ op: "set", path, value: item.value as never });
      continue;
    }

    if (op === "merge" && isRecord(item.value)) {
      ops.push({ op: "merge", path, value: item.value as never });
      continue;
    }

    if (op === "append_unique" && "value" in item) {
      ops.push({ op: "append_unique", path, value: item.value as never });
      continue;
    }

    if (op === "remove") {
      ops.push({ op: "remove", path });
    }
  }

  return ops.length ? ops : undefined;
}

function normalizeMemoryUpserts(value: unknown): MemoryUpsertInput[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: MemoryUpsertInput[] = [];

  for (const item of value) {
    if (!isRecord(item)) continue;
    const text = typeof item.text === "string" ? item.text : "";
    const scope = item.scope === "folder" ? "folder" : "user";
    const tags = Array.isArray(item.tags) ? item.tags.filter((t) => typeof t === "string") : [];
    const folderId = typeof item.folderId === "string" ? item.folderId : null;
    const confidence =
      item.confidence === "low" || item.confidence === "high" ? item.confidence : "medium";
    const supersedes = Array.isArray(item.supersedes)
      ? item.supersedes.filter((t) => typeof t === "string")
      : undefined;

    if (!text.trim()) continue;
    if (scope === "folder" && !folderId?.trim()) continue;
    if (tags.length === 0) continue;

    out.push({ text, tags, scope, ...(scope === "folder" ? { folderId } : {}), confidence, supersedes });
  }

  return out.length ? out : undefined;
}

function normalizePlan(value: unknown): MemoryWriterPlan {
  if (!isRecord(value)) return {};
  const profilePatch = normalizePatchOps(value.profilePatch);
  const folderDocPatch = normalizePatchOps(value.folderDocPatch);
  const memoryUpserts = normalizeMemoryUpserts(value.memoryUpserts);
  const notes = typeof value.notes === "string" ? value.notes : undefined;
  return { profilePatch, folderDocPatch, memoryUpserts, notes };
}

export function buildMemoryWriterSystemPrompt(params: {
  isFirstUserMessageInThread: boolean;
  isFolderThread: boolean;
  folderId: string | null;
  forceFirstMessageMemoryUpsert: boolean;
  forceFirstMessageFolderDocUpsert: boolean;
  enableProfileUpdates: boolean;
  enableFolderDocUpdates: boolean;
  enableMemoryUpdates: boolean;
  contextMemorySnapshotMarkdown: string;
}): string {
  const forceMemory =
    params.isFirstUserMessageInThread && params.forceFirstMessageMemoryUpsert;
  const forceFolder =
    params.isFolderThread &&
    params.isFirstUserMessageInThread &&
    params.forceFirstMessageFolderDocUpsert;

  return [
    "You are a memory writer designed to output ONLY valid JSON (no markdown fences).",
    "",
    "Task:",
    "- Update long-term memory artifacts for the user based on the thread's USER messages.",
    "- You must follow the JSON schema exactly.",
    "",
    "JSON schema:",
    "{",
    '  "profilePatch": [ { "op":"set|merge|append_unique|remove", "path":"/...", "value": ... } ]?,',
    '  "folderDocPatch": [ { "op":"set|merge|append_unique|remove", "path":"/...", "value": ... } ]?,',
    '  "memoryUpserts": [ { "text":"...", "tags":["tag"], "scope":"user|folder", "folderId":"...", "confidence":"low|medium|high", "supersedes":["memoryId"]? } ]?,',
    '  "notes": "optional debug notes"?',
    "}",
    "",
    "Memory text rules:",
    "- Each memoryUpserts.text MUST be a short paragraph (1-4 sentences).",
    "- No sensitive secrets (passwords, tokens, OTPs, private keys, bank cards, SSNs, exact addresses).",
    "- If uncertain, either omit or mark confidence=low.",
    "",
    "Tag rules:",
    "- tags must be 1-6 items.",
    "- lowercase, hyphen-separated (e.g., \"writing-style\", \"project-x\").",
    "",
    `Thread info: isFirstUserMessage=${String(params.isFirstUserMessageInThread)}, isFolderThread=${String(params.isFolderThread)}, folderId=${params.folderId ?? "null"}`,
    "",
    "Profile/FolderDoc JSON conventions (recommended top-level keys):",
    "- /identity: object of stable identity facts",
    "- /preferences: object of stable preferences (language, tone, format, etc.)",
    "- /constraints: array of constraints",
    "- /goals: array of long-term goals",
    "- /notes: array of short notes",
    "- FolderDoc can also use: /summary (string), /keyFacts (array), /conventions (array), /openLoops (array)",
    "",
    params.enableProfileUpdates
      ? "- You MAY output profilePatch to update the user profile."
      : "- You MUST NOT output profilePatch (disabled).",
    params.enableFolderDocUpdates
      ? "- You MAY output folderDocPatch to update the folder doc."
      : "- You MUST NOT output folderDocPatch (disabled).",
    params.enableMemoryUpdates
      ? "- You MAY output memoryUpserts to add/update atomic memories."
      : "- You MUST NOT output memoryUpserts (disabled).",
    "",
    forceMemory
      ? "Hard requirement: memoryUpserts MUST contain at least 1 item."
      : "Hard requirement: memoryUpserts is optional.",
    forceFolder
      ? "Hard requirement: folderDocPatch MUST contain at least 1 operation."
      : "Hard requirement: folderDocPatch is optional.",
    "",
    "Context memory snapshot already present in the main prompt (read-only, do NOT duplicate):",
    params.contextMemorySnapshotMarkdown.trim() ? params.contextMemorySnapshotMarkdown : "(empty)",
  ].join("\n");
}
