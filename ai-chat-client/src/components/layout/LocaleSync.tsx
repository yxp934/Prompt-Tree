"use client";

import { useEffect } from "react";

import { useAppStore } from "@/store/useStore";

export default function LocaleSync() {
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}

