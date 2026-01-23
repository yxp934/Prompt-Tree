"use client";

import { formatDistanceToNow } from "date-fns";
import { useMemo, useState } from "react";

import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { getOpenAIApiKey, setOpenAIApiKey } from "@/lib/services/apiKeyService";
import { useAppStore } from "@/store/useStore";
import type { ConversationTree } from "@/types";

function ClockIcon() {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="2" />
      <path strokeWidth="2" d="M12 6v6l4 2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
    </svg>
  );
}

interface ThreadItemProps {
  tree: ConversationTree;
  isActive: boolean;
  nodeCount: number | null;
  onClick: () => void;
}

function ThreadItem({ tree, isActive, nodeCount, onClick }: ThreadItemProps) {
  const timeAgo = useMemo(
    () => formatDistanceToNow(new Date(tree.updatedAt), { addSuffix: true }),
    [tree.updatedAt],
  );

  return (
    <div
      className={`relative mb-1 cursor-pointer rounded-[10px] p-4 transition-all duration-150 ${
        isActive ? "bg-paper" : "hover:bg-paper"
      }`}
      onClick={onClick}
    >
      <div
        className={`absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-copper transition-all duration-200 ${
          isActive ? "h-6" : "h-0"
        }`}
      />

      <div className="mb-1.5 text-[0.9rem] font-medium leading-tight text-ink">
        {tree.title}
      </div>

      <div className="flex items-center gap-3 font-mono text-[0.7rem] text-sand">
        <span className="flex items-center gap-1">
          <ClockIcon />
          {timeAgo}
        </span>
        <span>{nodeCount ?? "—"} nodes</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const trees = useAppStore((s) => Array.from(s.trees.values()));
  const currentTreeId = useAppStore((s) => s.currentTreeId);
  const currentNodesCount = useAppStore((s) => s.nodes.size);

  const createTree = useAppStore((s) => s.createTree);
  const loadTree = useAppStore((s) => s.loadTree);

  const sortedTrees = useMemo(
    () => trees.slice().sort((a, b) => b.updatedAt - a.updatedAt),
    [trees],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKeyState] = useState("");

  return (
    <aside className="flex h-full flex-col border-r border-parchment bg-cream">
      <div className="border-b border-parchment px-7 pb-6 pt-8">
        <h1 className="brand-dot flex items-baseline gap-2 font-display text-[1.75rem] font-normal tracking-tight text-ink">
          Cortex
        </h1>
        <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
          Dialogue Topology
        </div>
      </div>

      <button
        className="mx-5 mt-5 flex items-center gap-2.5 rounded-lg bg-ink px-5 py-3.5 font-body text-[0.9rem] font-medium text-cream transition-all duration-200 hover:-translate-y-px hover:bg-charcoal"
        onClick={() => void createTree()}
      >
        <PlusIcon />
        New Thread
      </button>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-3 px-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          Threads
        </div>

        {sortedTrees.map((tree) => (
          <ThreadItem
            key={tree.id}
            tree={tree}
            isActive={currentTreeId === tree.id}
            nodeCount={currentTreeId === tree.id ? currentNodesCount : null}
            onClick={() => void loadTree(tree.id)}
          />
        ))}
      </div>

      <div className="border-t border-parchment p-5">
        <button
          className="flex w-full items-center gap-2.5 rounded-lg border border-parchment bg-transparent px-4 py-3 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-sand hover:text-ink"
          onClick={() => {
            setApiKeyState(getOpenAIApiKey() ?? "");
            setSettingsOpen(true);
          }}
        >
          <SettingsIcon />
          Settings
        </button>
      </div>

      <Modal
        open={settingsOpen}
        title="Settings"
        onClose={() => setSettingsOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <div className="mb-2 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
              OpenAI API Key
            </div>
            <Input
              value={apiKey}
              onChange={(e) => setApiKeyState(e.target.value)}
              placeholder="sk-..."
              type="password"
              autoComplete="off"
            />
            <div className="mt-2 text-[0.75rem] text-sand">
              Stored locally in your browser. Used to call OpenAI via `/api/chat`.
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setOpenAIApiKey("");
                setApiKeyState("");
              }}
            >
              Clear
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setOpenAIApiKey(apiKey);
                setSettingsOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}
