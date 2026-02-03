"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatView } from "@/components/chat/ChatView";
import FolderView from "@/components/folder/FolderView";
import { TreeCanvasFloating } from "@/components/tree/TreeCanvasFloating";
import { useT } from "@/lib/i18n/useT";
import { useAppStore } from "@/store/useStore";

import ContextPanel from "./ContextPanel";
import Header from "./Header";
import Sidebar from "./Sidebar";

const RESIZER_SIZE = 8;
const DEFAULT_SIDEBAR_WIDTH = 280;
const DEFAULT_CONTEXT_WIDTH = 340;
const MIN_SIDEBAR_WIDTH = 220;
const MIN_CONTEXT_WIDTH = 260;
const MIN_CENTER_WIDTH = 360;
const LAYOUT_STORAGE_KEY = "prompt-tree.layout.v1";
const LEGACY_LAYOUT_STORAGE_KEY = "cortex.layout.v1";

type DragTarget = "sidebar" | "context" | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function MainLayout() {
  const t = useT();
  const initialize = useAppStore((s) => s.initialize);
  const currentView = useAppStore((s) => s.currentView);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const contextPanelOpen = useAppStore((s) => s.contextPanelOpen);
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen);

  const layoutRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [contextWidth, setContextWidth] = useState(DEFAULT_CONTEXT_WIDTH);
  const [dragging, setDragging] = useState<DragTarget>(null);
  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => {
      if (mediaQuery.matches) {
        setSidebarOpen(true);
        setContextPanelOpen(true);
      } else {
        setSidebarOpen(false);
        setContextPanelOpen(false);
      }
    };
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [setContextPanelOpen, setSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    const legacy = stored
      ? null
      : window.localStorage.getItem(LEGACY_LAYOUT_STORAGE_KEY);
    const raw = stored ?? legacy;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        sidebarWidth?: number;
        contextWidth?: number;
      };
      if (typeof parsed.sidebarWidth === "number") {
        setSidebarWidth(parsed.sidebarWidth);
      }
      if (typeof parsed.contextWidth === "number") {
        setContextWidth(parsed.contextWidth);
      }
      if (legacy) {
        window.localStorage.setItem(LAYOUT_STORAGE_KEY, raw);
        window.localStorage.removeItem(LEGACY_LAYOUT_STORAGE_KEY);
      }
    } catch {
      return;
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!layoutRef.current) return;
      const layoutRect = layoutRef.current.getBoundingClientRect();

      if (dragging === "sidebar") {
        const maxWidth = Math.max(
          MIN_SIDEBAR_WIDTH,
          layoutRect.width - MIN_CENTER_WIDTH - contextWidth - RESIZER_SIZE * 2,
        );
        const next = clamp(event.clientX - layoutRect.left, MIN_SIDEBAR_WIDTH, maxWidth);
        setSidebarWidth(next);
        return;
      }

      if (dragging === "context") {
        const maxWidth = Math.max(
          MIN_CONTEXT_WIDTH,
          layoutRect.width - MIN_CENTER_WIDTH - sidebarWidth - RESIZER_SIZE * 2,
        );
        const next = clamp(layoutRect.right - event.clientX, MIN_CONTEXT_WIDTH, maxWidth);
        setContextWidth(next);
        return;
      }
    },
    [contextWidth, dragging, sidebarWidth],
  );

  useEffect(() => {
    if (!dragging) return;
    const handlePointerUp = () => setDragging(null);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, handlePointerMove]);

  useEffect(() => {
    if (dragging) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        sidebarWidth,
        contextWidth,
      }),
    );
  }, [contextWidth, dragging, sidebarWidth]);

  useEffect(() => {
    const handleResize = () => {
      if (!layoutRef.current) return;
      const layoutRect = layoutRef.current.getBoundingClientRect();
      const maxSidebar = Math.max(
        MIN_SIDEBAR_WIDTH,
        layoutRect.width - MIN_CENTER_WIDTH - contextWidth - RESIZER_SIZE * 2,
      );
      if (sidebarWidth > maxSidebar) {
        setSidebarWidth(maxSidebar);
      }
      const maxContext = Math.max(
        MIN_CONTEXT_WIDTH,
        layoutRect.width - MIN_CENTER_WIDTH - sidebarWidth - RESIZER_SIZE * 2,
      );
      if (contextWidth > maxContext) {
        setContextWidth(maxContext);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [contextWidth, sidebarWidth]);

  const gridStyle = {
    gridTemplateColumns: `${sidebarWidth}px ${RESIZER_SIZE}px minmax(0, 1fr) ${RESIZER_SIZE}px ${contextWidth}px`,
  };

  return (
    <div
      ref={layoutRef}
      className="relative flex h-screen min-h-0 flex-col lg:grid lg:grid-rows-[minmax(0,1fr)]"
      style={gridStyle}
    >
      <div
        className={`fixed inset-y-0 left-0 z-40 min-h-0 w-[82vw] max-w-[280px] -translate-x-full bg-cream transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-full lg:max-w-none lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : ""}`}
      >
        <Sidebar />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        className="group hidden h-full cursor-col-resize select-none touch-none items-center justify-center border-r border-parchment/60 bg-paper/40 transition-colors lg:flex"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          setDragging("sidebar");
        }}
      >
        <div className="h-12 w-[3px] rounded-full bg-parchment transition-colors group-hover:bg-copper" />
      </div>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
          aria-label={t("layout.closeSidebarAria")}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
        <Header />

        {currentView === "folder" ? (
          <FolderView />
        ) : (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <TreeCanvasFloating />
            <ChatView />
          </div>
        )}
      </main>

      <div
        role="separator"
        aria-orientation="vertical"
        className="group hidden h-full cursor-col-resize select-none touch-none items-center justify-center border-l border-parchment/60 bg-paper/40 transition-colors lg:flex"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          setDragging("context");
        }}
      >
        <div className="h-12 w-[3px] rounded-full bg-parchment transition-colors group-hover:bg-copper" />
      </div>
      <div
        className={`fixed inset-y-0 right-0 z-40 min-h-0 w-[90vw] max-w-[360px] translate-x-full bg-cream transition-transform duration-200 lg:static lg:z-auto lg:h-full lg:w-full lg:max-w-none lg:translate-x-0 ${contextPanelOpen ? "translate-x-0" : ""}`}
      >
        <ContextPanel />
      </div>
      {contextPanelOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
          aria-label={t("layout.closeContextPanelAria")}
          onClick={() => setContextPanelOpen(false)}
        />
      ) : null}
    </div>
  );
}
