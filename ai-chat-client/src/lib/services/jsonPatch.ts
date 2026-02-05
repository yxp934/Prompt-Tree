import type { JsonObject, JsonPatchOp, JsonValue } from "@/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function splitPath(path: string): string[] {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return [];
  const normalized = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  return normalized.split("/").map((p) => p.trim()).filter(Boolean);
}

function deepEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i] as JsonValue, b[i] as JsonValue)) return false;
    }
    return true;
  }

  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!(key in b)) return false;
      if (!deepEqual(a[key] as JsonValue, b[key] as JsonValue)) return false;
    }
    return true;
  }

  return false;
}

function ensureContainer(root: JsonObject, segments: string[]): JsonObject {
  let current: JsonObject = root;
  for (const key of segments) {
    const existing = current[key];
    if (isObject(existing)) {
      current = existing as unknown as JsonObject;
      continue;
    }
    const next: JsonObject = {};
    current[key] = next;
    current = next;
  }
  return current;
}

export function applyJsonPatch(doc: JsonObject, ops: JsonPatchOp[]): JsonObject {
  if (!ops.length) return doc;
  const next = cloneJson(doc);

  for (const op of ops) {
    const segments = splitPath(op.path);
    const parentSegments = segments.slice(0, Math.max(0, segments.length - 1));
    const leaf = segments[segments.length - 1] ?? "";
    const container = ensureContainer(next, parentSegments);

    if (op.op === "set") {
      if (!leaf) continue;
      container[leaf] = cloneJson(op.value) as JsonValue;
      continue;
    }

    if (op.op === "merge") {
      if (!leaf) continue;
      const existing = container[leaf];
      const base: JsonObject = isObject(existing) ? (existing as unknown as JsonObject) : {};
      container[leaf] = { ...base, ...cloneJson(op.value) };
      continue;
    }

    if (op.op === "append_unique") {
      if (!leaf) continue;
      const existing = container[leaf];
      const arr = Array.isArray(existing) ? (existing as JsonValue[]) : [];
      const value = cloneJson(op.value) as JsonValue;
      if (!arr.some((item) => deepEqual(item, value))) {
        arr.push(value);
      }
      container[leaf] = arr;
      continue;
    }

    if (op.op === "remove") {
      if (!leaf) continue;
      if (Object.prototype.hasOwnProperty.call(container, leaf)) {
        delete container[leaf];
      }
    }
  }

  return next;
}

