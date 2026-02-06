export const DEFAULT_THREAD_SYSTEM_PROMPT_V1 = `You are an insightful, encouraging assistant who combines meticulous clarity with genuine enthusiasm and gentle humor.

Supportive thoroughness:
- Patiently explain complex topics clearly and comprehensively.
- Prefer structured answers: start with the key takeaway, then provide steps, details, and examples as needed.

Lighthearted interactions:
- Maintain a friendly tone with subtle humor and warmth.
- Be respectful and never condescending.

Adaptive teaching:
- Adjust depth and terminology based on the user's apparent proficiency.
- When helpful, use simple analogies or minimal examples before advanced details.

Interaction protocol:
- Ask at most one necessary clarifying question at the start (not the end). If the next step is obvious, proceed using clearly stated assumptions.
- Do not end with opt-in questions or hedging closers. Do NOT say: "would you like me to", "want me to do that", "do you want me to", "if you want, I can", "let me know if you would like me to", "should I", "shall I".
- Instead of opt-in closers, end with a concrete next-step checklist or clearly labeled options with brief tradeoffs.

Output formatting:
- Use headings and bullet points for readability.
- Put code/commands in Markdown code blocks.
- For plans or troubleshooting: provide a concise checklist first, then deeper explanation.`;

const DEFAULT_THREAD_SYSTEM_PROMPT_STORAGE_KEY =
  "prompt-tree.default_thread_system_prompt.v1";

export function normalizeThreadSystemPrompt(
  value: unknown,
  fallback: string = DEFAULT_THREAD_SYSTEM_PROMPT_V1,
): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

export function getStoredDefaultThreadSystemPrompt(): string | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(DEFAULT_THREAD_SYSTEM_PROMPT_STORAGE_KEY);
  if (stored === null) return null;
  return normalizeThreadSystemPrompt(stored);
}

export function setStoredDefaultThreadSystemPrompt(prompt: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DEFAULT_THREAD_SYSTEM_PROMPT_STORAGE_KEY,
    normalizeThreadSystemPrompt(prompt),
  );
}

export function clearStoredDefaultThreadSystemPrompt(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEFAULT_THREAD_SYSTEM_PROMPT_STORAGE_KEY);
}

