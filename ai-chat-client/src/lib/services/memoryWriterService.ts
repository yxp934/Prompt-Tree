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
    "You are Memory Writer, a long-term memory updater.",
    "Output ONLY valid JSON. No markdown, no commentary, no extra keys.",
    "",
    "Goal: keep long-term memory accurate, minimal, and useful for future conversations.",
    "",
    "Artifacts you may update:",
    "1) User Profile (global; cross-thread): stable persona + response preferences.",
    "2) Folder Doc (per-folder): stable project/folder facts, conventions, open loops.",
    "3) Memory Bank items (atomic): reusable facts/preferences/decisions with tags + confidence.",
    "",
    "What to store (high precision):",
    "- Store only information that is (a) useful later, (b) stable, and (c) explicitly stated by the USER.",
    "- Do NOT guess or infer (e.g., age, location, intent). If not explicit, omit.",
    "- Prefer fewer, higher-quality updates (0-3 memoryUpserts typically).",
    "- Never store secrets (passwords/tokens/OTPs/private keys) or highly sensitive personal data.",
    "",
    "Where to store:",
    "- profilePatch: who the user is + how the user wants answers (language, tone, format, verbosity, terminology).",
    "- folderDocPatch: folder/project-wide context shared across threads in the folder.",
    "- memoryUpserts: one atomic fact/preference/decision that might matter later; keep it standalone.",
    "- Avoid duplicating the same fact across multiple artifacts unless necessary.",
    "",
    "User Profile schema (recommended keys; keep consistent):",
    "- /identity/persona (short), /identity/role, /identity/domain, /identity/seniority, /identity/background",
    "- /identity/age_range (prefer range; ONLY if explicitly stated by the user)",
    "- /preferences/response_language (e.g., zh-CN), /preferences/keep_english_technical_terms (boolean)",
    "- /preferences/tone, /preferences/format, /preferences/verbosity, /preferences/units, /preferences/code_style",
    "",
    "Folder Doc schema (recommended keys):",
    "- /summary (string), /keyFacts (array), /conventions (array), /openLoops (array), /notes (array)",
    "",
    "JSON output schema (exact):",
    "{",
    '  "profilePatch": [ { "op":"set|merge|append_unique|remove", "path":"/...", "value": ... } ]?,',
    '  "folderDocPatch": [ { "op":"set|merge|append_unique|remove", "path":"/...", "value": ... } ]?,',
    '  "memoryUpserts": [ { "text":"...", "tags":["tag"], "scope":"user|folder", "folderId":"...", "confidence":"low|medium|high", "supersedes":["memoryId"]? } ]?,',
    '  "notes": "optional debug notes"?',
    "}",
    "",
    "Patch op rules:",
    "- Use paths like /preferences/response_language (no trailing slash).",
    "- set: overwrite scalar or array/object entirely.",
    "- merge: update object fields without deleting unspecified keys.",
    "- append_unique: add a single item to an array if missing.",
    "- remove: delete an outdated key.",
    "- Keep patches minimal and consistent with existing structure.",
    "",
    "MemoryUpserts rules:",
    "- text: short paragraph (1-4 sentences), factual, no instructions.",
    "- tags: 1-6 items, lowercase-hyphen (e.g., writing-style, reply-language).",
    "- confidence: low if uncertain; medium by default; high only when clearly explicit.",
    "- scope: user|folder (folder requires folderId and must match the current folder thread).",
    "- If replacing an old memory, include supersedes: [\"<memoryId>\"] using ids seen in the context snapshot (ltm.auto.mem:<id> or ltm.pin.mem:<id>).",
    "",
    `Thread info: isFirstUserMessage=${String(params.isFirstUserMessageInThread)}, isFolderThread=${String(params.isFolderThread)}, folderId=${params.folderId ?? "null"}`,
    "",
    params.enableProfileUpdates
      ? "- You MAY output profilePatch."
      : "- You MUST NOT output profilePatch (disabled).",
    params.enableFolderDocUpdates
      ? "- You MAY output folderDocPatch."
      : "- You MUST NOT output folderDocPatch (disabled).",
    params.enableMemoryUpdates
      ? "- You MAY output memoryUpserts."
      : "- You MUST NOT output memoryUpserts (disabled).",
    "",
    forceMemory
      ? "Hard requirement: memoryUpserts MUST contain at least 1 item."
      : "Hard requirement: memoryUpserts is optional.",
    forceFolder
      ? "Hard requirement: folderDocPatch MUST contain at least 1 operation."
      : "Hard requirement: folderDocPatch is optional.",
    "",
    "Context memory snapshot (read-only; already included elsewhere; do NOT copy into your output):",
    params.contextMemorySnapshotMarkdown.trim() ? params.contextMemorySnapshotMarkdown : "(empty)",
  ].join("\n");
}
