"use client";

import ThemeSync from "./ThemeSync";
import LocaleSync from "./LocaleSync";
import StoreHydration from "./StoreHydration";

export default function ClientGlobals() {
  return (
    <>
      <StoreHydration />
      <ThemeSync />
      <LocaleSync />
    </>
  );
}
