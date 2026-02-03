"use client";

import { useMemo } from "react";

import { useAppStore } from "@/store/useStore";

import { t as translate, type MessageKey, type MessageParams } from "./translate";

export function useT() {
  const locale = useAppStore((s) => s.locale);

  return useMemo(
    () => (key: MessageKey, params?: MessageParams) => translate(locale, key, params),
    [locale],
  );
}

