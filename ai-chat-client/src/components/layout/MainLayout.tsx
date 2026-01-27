"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatView } from "@/components/chat/ChatView";
import { BranchList } from "@/components/tree/BranchList";
import { TreeView } from "@/components/tree/TreeView";
import { useAppStore } from "@/store/useStore";

import ContextPanel from "./ContextPanel";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ThemeSync from "./ThemeSync";

const RESIZER_SIZE = 8;
const DEFAULT_SIDEBAR_WIDTH = 280;
const DEFAULT_CONTEXT_WIDTH = 340;
const DEFAULT_TREE_RATIO = 0.42;
const MIN_SIDEBAR_WIDTH = 220;
const MIN_CONTEXT_WIDTH = 260;
const MIN_CENTER_WIDTH = 360;
const MIN_TREE_HEIGHT = 180;
const MIN_CHAT_HEIGHT = 260;
const LAYOUT_STORAGE_KEY = "cortex.layout.v1";

type DragTarget = "sidebar" | "context" | "tree" | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function MainLayout() {
  const initialize = useAppStore((s) => s.initialize);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const contextPanelOpen = useAppStore((s) => s.contextPanelOpen);
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen);

  const layoutRef = useRef<HTMLDivElement>(null);
  const splitRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [contextWidth, setContextWidth] = useState(DEFAULT_CONTEXT_WIDTH);
  const [treeHeight, setTreeHeight] = useState<number | null>(null);
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
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        sidebarWidth?: number;
        contextWidth?: number;
        treeHeight?: number;
      };
      if (typeof parsed.sidebarWidth === "number") {
        setSidebarWidth(parsed.sidebarWidth);
      }
      if (typeof parsed.contextWidth === "number") {
        setContextWidth(parsed.contextWidth);
      }
      if (typeof parsed.treeHeight === "number") {
        setTreeHeight(parsed.treeHeight);
      }
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (treeHeight !== null) return;
    if (typeof window === "undefined") return;
    const container = splitRef.current;
    const height = container?.getBoundingClientRect().height ?? window.innerHeight;
    if (!height) return;
    setTreeHeight(Math.round(height * DEFAULT_TREE_RATIO));
  }, [treeHeight]);

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

      if (dragging === "tree") {
        const splitRect = splitRef.current?.getBoundingClientRect();
        if (!splitRect) return;
        const maxHeight = Math.max(
          MIN_TREE_HEIGHT,
          splitRect.height - MIN_CHAT_HEIGHT - RESIZER_SIZE,
        );
        const next = clamp(event.clientY - splitRect.top, MIN_TREE_HEIGHT, maxHeight);
        setTreeHeight(next);
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
    document.body.style.cursor = dragging === "tree" ? "row-resize" : "col-resize";
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
    if (treeHeight === null) return;
    window.localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({
        sidebarWidth,
        contextWidth,
        treeHeight,
      }),
    );
  }, [contextWidth, dragging, sidebarWidth, treeHeight]);

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
      if (!splitRef.current) return;
      if (treeHeight === null) return;
      const splitRect = splitRef.current.getBoundingClientRect();
      const maxTree = Math.max(
        MIN_TREE_HEIGHT,
        splitRect.height - MIN_CHAT_HEIGHT - RESIZER_SIZE,
      );
      if (treeHeight > maxTree) {
        setTreeHeight(maxTree);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [contextWidth, sidebarWidth, treeHeight]);

  const gridStyle = {
    gridTemplateColumns: `${sidebarWidth}px ${RESIZER_SIZE}px minmax(0, 1fr) ${RESIZER_SIZE}px ${contextWidth}px`,
  };

  return (
    <div
      ref={layoutRef}
      className="relative flex h-screen min-h-0 flex-col lg:grid lg:grid-rows-[minmax(0,1fr)]"
      style={gridStyle}
    >
      <ThemeSync />
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
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
        <Header />

        <div className="relative flex min-h-0 flex-1 flex-col">
          <BranchList floating />

          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col">
            <div
              className="tree-canvas-bg tree-canvas-grid relative h-[42%] overflow-hidden border-b border-parchment lg:border-b-0"
              style={treeHeight ? { height: treeHeight } : undefined}
            >
              <TreeView />
            </div>
            <div
              role="separator"
              aria-orientation="horizontal"
              className="group hidden h-2 cursor-row-resize select-none touch-none items-center justify-center border-y border-parchment bg-paper/70 lg:flex"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                setDragging("tree");
              }}
            >
              <div className="h-[3px] w-14 rounded-full bg-parchment transition-colors group-hover:bg-copper" />
            </div>
            <ChatView />
          </div>
        </div>
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
          aria-label="Close context panel"
          onClick={() => setContextPanelOpen(false)}
        />
      ) : null}
    </div>
  );
}
