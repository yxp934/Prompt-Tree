import type { FolderDoc, JsonObject, JsonValue, UserProfileDoc } from "@/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toString(value: JsonValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((v) => toString(v as JsonValue)).filter(Boolean).join(", ");
  if (isObject(value)) return JSON.stringify(value);
  return "";
}

function renderKeyValueTable(obj: JsonObject): string[] {
  const lines: string[] = [];
  for (const [key, raw] of Object.entries(obj)) {
    const value = toString(raw);
    if (!value.trim()) continue;
    lines.push(`- ${key}: ${value}`);
  }
  return lines;
}

function renderStringList(title: string, value: JsonValue | undefined): string[] {
  const arr = Array.isArray(value) ? value : [];
  const items = arr.map((v) => toString(v as JsonValue).trim()).filter(Boolean);
  if (items.length === 0) return [];
  return [`## ${title}`, ...items.map((v) => `- ${v}`)];
}

export function renderUserProfileMarkdown(doc: UserProfileDoc): string {
  const data = doc.data ?? {};
  const identity = isObject(data.identity) ? (data.identity as JsonObject) : {};
  const preferences = isObject(data.preferences) ? (data.preferences as JsonObject) : {};

  const lines: string[] = [];
  lines.push("# User Profile");
  lines.push(`Updated: ${new Date(doc.updatedAt).toISOString()}`);

  const identityLines = renderKeyValueTable(identity);
  if (identityLines.length) {
    lines.push("", "## Identity", ...identityLines);
  }

  const prefLines = renderKeyValueTable(preferences);
  if (prefLines.length) {
    lines.push("", "## Preferences", ...prefLines);
  }

  const constraints = renderStringList("Constraints", data.constraints);
  if (constraints.length) lines.push("", ...constraints);

  const goals = renderStringList("Goals", data.goals);
  if (goals.length) lines.push("", ...goals);

  const notes = renderStringList("Notes", data.notes);
  if (notes.length) lines.push("", ...notes);

  if (lines.length <= 2) {
    lines.push("", "_(empty)_");
  }

  return lines.join("\n").trim();
}

export function renderFolderDocMarkdown(doc: FolderDoc): string {
  const data = doc.data ?? {};
  const summary = typeof data.summary === "string" ? data.summary.trim() : "";

  const lines: string[] = [];
  lines.push("# Folder Doc");
  lines.push(`Folder: ${doc.folderId}`);
  lines.push(`Updated: ${new Date(doc.updatedAt).toISOString()}`);

  if (summary) {
    lines.push("", "## Summary", summary);
  }

  const keyFacts = renderStringList("Key Facts", data.keyFacts);
  if (keyFacts.length) lines.push("", ...keyFacts);

  const conventions = renderStringList("Conventions", data.conventions);
  if (conventions.length) lines.push("", ...conventions);

  const openLoops = renderStringList("Open Loops", data.openLoops);
  if (openLoops.length) lines.push("", ...openLoops);

  const notes = renderStringList("Notes", data.notes);
  if (notes.length) lines.push("", ...notes);

  if (lines.length <= 3) {
    lines.push("", "_(empty)_");
  }

  return lines.join("\n").trim();
}

