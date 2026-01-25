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
  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_340px]">
      <ThemeSync />
      <Sidebar />

      <main className="relative flex flex-col bg-paper">
        <Header />

        <BranchList />

        <div className="tree-canvas-bg tree-canvas-grid relative h-[42%] overflow-hidden border-b border-parchment">
          <TreeView />
        </div>

        <ChatView />
      </main>

      <ContextPanel />
    </div>
  );
}
