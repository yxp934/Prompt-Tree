import type { Locale } from "@/lib/services/localeService";

import { messages, type MessageKey } from "./messages";

export type MessageParams = Record<string, string | number | null | undefined>;

function formatTemplate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replaceAll(/\{(\w+)\}/g, (_match, key: string) => {
    const raw = params[key];
    if (raw === null || raw === undefined) return "";
    return String(raw);
  });
}

export function t(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const table = messages[locale] ?? messages.en;
  const template = table[key] ?? messages.en[key];
  return formatTemplate(template, params);
}

export function isMessageKey(value: string): value is MessageKey {
  return Object.prototype.hasOwnProperty.call(messages.en, value);
}

export type { MessageKey };
