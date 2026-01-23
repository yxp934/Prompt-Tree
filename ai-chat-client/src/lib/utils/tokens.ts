/**
 * Very rough heuristic token estimator (no model-specific encoding).
 * Good enough for MVP token budgeting + UI meters.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;

  // English ~ 4 chars/token; CJK tends to be denser, so use ~2 chars/token.
  const cjkCount = (trimmed.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? [])
    .length;
  const otherCount = trimmed.length - cjkCount;

  return Math.ceil(otherCount / 4 + cjkCount / 2);
}

