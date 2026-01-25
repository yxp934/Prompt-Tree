"use client";

import { useEffect } from "react";

import { ChatView } from "@/components/chat/ChatView";
import { BranchList } from "@/components/tree/BranchList";
import { TreeView } from "@/components/tree/TreeView";
import { useAppStore } from "@/store/useStore";

import ContextPanel from "./ContextPanel";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ThemeSync from "./ThemeSync";

export default function MainLayout() {
  const initialize = useAppStore((s) => s.initialize);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const contextPanelOpen = useAppStore((s) => s.contextPanelOpen);
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen);
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

  return (
    <div className="relative flex h-screen flex-col lg:grid lg:grid-cols-[280px_1fr_340px]">
      <ThemeSync />
      <div
        className={`fixed inset-y-0 left-0 z-40 w-[82vw] max-w-[280px] -translate-x-full bg-cream transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : ""}`}
      >
        <Sidebar />
      </div>
      {sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="relative flex min-h-0 flex-1 flex-col bg-paper">
        <Header />

        <BranchList />

        <div className="tree-canvas-bg tree-canvas-grid relative h-[42%] overflow-hidden border-b border-parchment">
          <TreeView />
        </div>

        <ChatView />
      </main>

      <div
        className={`fixed inset-y-0 right-0 z-40 w-[90vw] max-w-[360px] translate-x-full bg-cream transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 ${contextPanelOpen ? "translate-x-0" : ""}`}
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
