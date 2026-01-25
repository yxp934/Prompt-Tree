"use client";

import { useEffect, useMemo } from "react";

import { ChatView } from "@/components/chat/ChatView";
import { BranchList } from "@/components/tree/BranchList";
import { TreeView } from "@/components/tree/TreeView";
import { countLeafBranches } from "@/lib/services/dagService";
import { useAppStore } from "@/store/useStore";

import ContextPanel from "./ContextPanel";
import Sidebar from "./Sidebar";

export default function MainLayout() {
  const initialize = useAppStore((s) => s.initialize);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const nodesCount = useAppStore((s) => s.nodes.size);
  const nodes = useAppStore((s) => s.nodes);
  const model = useAppStore((s) => s.model);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const branchCount = useMemo(() => {
    if (!currentTree) return 0;
    return countLeafBranches(nodes.values(), currentTree.rootId);
  }, [currentTree, nodes]);

  return (
    <div className="grid h-screen grid-cols-[280px_1fr_340px]">
      <Sidebar />

      <main className="relative flex flex-col bg-paper">
        <header className="flex items-center justify-between border-b border-parchment bg-paper px-8 py-5">
          <h2 className="font-display text-[1.35rem] font-normal text-ink">
            {currentTree?.title ?? "Loading..."}
          </h2>
          <div className="flex gap-6 font-mono text-[0.75rem] text-sand">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{nodesCount}</span> nodes
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{branchCount}</span>{" "}
              branches
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-ink">{model}</span>
            </div>
          </div>
        </header>

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
