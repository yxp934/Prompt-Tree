"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { TrashIcon } from "@/components/common/icons";
import { computeNodeCountsForTrees } from "@/lib/services/treeStatsService";
import { useAppStore } from "@/store/useStore";
import { useT } from "@/lib/i18n/useT";
import type { ConversationFolder, ConversationTree } from "@/types";

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

function FolderIcon() {
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
        d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
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
  onDelete: () => void;
}

function ThreadItem({
  tree,
  isActive,
  nodeCount,
  onClick,
  onDelete,
}: ThreadItemProps) {
  const t = useT();
  const timeAgo = useMemo(
    () => formatDistanceToNow(new Date(tree.updatedAt), { addSuffix: true }),
    [tree.updatedAt],
  );

  return (
    <div
      className={`group relative mb-1 cursor-pointer rounded-[10px] p-4 transition-all duration-150 ${
        isActive ? "bg-paper" : "hover:bg-paper"
      }`}
      onClick={onClick}
    >
      <button
        type="button"
        className="absolute right-3 top-3 rounded-md p-1 text-sand opacity-0 transition-all duration-150 hover:bg-paper hover:text-[#e74c3c] group-hover:opacity-100"
        aria-label={t("sidebar.deleteThreadAria")}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
      >
        <TrashIcon />
      </button>

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
        <span>{t("sidebar.nodeCount", { count: nodeCount ?? "—" })}</span>
      </div>
    </div>
  );
}

interface FolderItemProps {
  folder: ConversationFolder;
  isActive: boolean;
  threadCount: number;
  activityAt: number;
  onClick: () => void;
  onDelete: () => void;
}

function FolderItem({
  folder,
  isActive,
  threadCount,
  activityAt,
  onClick,
  onDelete,
}: FolderItemProps) {
  const t = useT();
  const timeAgo = useMemo(
    () => formatDistanceToNow(new Date(activityAt), { addSuffix: true }),
    [activityAt],
  );

  return (
    <div
      className={`group relative mb-1 cursor-pointer rounded-[10px] p-4 transition-all duration-150 ${
        isActive ? "bg-paper" : "hover:bg-paper"
      }`}
      onClick={onClick}
    >
      <div
        className={`absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-sm bg-copper transition-all duration-200 ${
          isActive ? "h-6" : "h-0"
        }`}
      />

      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="text-[0.9rem] font-medium leading-tight text-ink">
          {folder.name}
        </div>
        <div className="flex items-center gap-2 text-sand">
          <button
            type="button"
            className="rounded-md p-1 text-sand opacity-0 transition-all duration-150 hover:bg-paper hover:text-[#e74c3c] group-hover:opacity-100"
            aria-label={t("sidebar.deleteFolderAria")}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon />
          </button>
          <FolderIcon />
        </div>
      </div>

      <div className="flex items-center gap-3 font-mono text-[0.7rem] text-sand">
        <span className="flex items-center gap-1">
          <ClockIcon />
          {timeAgo}
        </span>
        <span>{t("sidebar.threadCount", { count: threadCount })}</span>
      </div>
    </div>
  );
}

type SidebarEntry =
  | {
      kind: "folder";
      id: string;
      activityAt: number;
      folder: ConversationFolder;
      threadCount: number;
    }
  | {
      kind: "thread";
      id: string;
      activityAt: number;
      tree: ConversationTree;
    };

export default function Sidebar() {
  const t = useT();
  const treesMap = useAppStore((s) => s.trees);
  const foldersMap = useAppStore((s) => s.folders);
  const currentTreeId = useAppStore((s) => s.currentTreeId);
  const currentTree = useAppStore((s) => s.getCurrentTree());
  const currentView = useAppStore((s) => s.currentView);
  const currentFolderId = useAppStore((s) => s.currentFolderId);
  const currentNodesCount = useAppStore((s) => s.nodes.size);

  const createTree = useAppStore((s) => s.createTree);
  const createFolder = useAppStore((s) => s.createFolder);
  const deleteTree = useAppStore((s) => s.deleteTree);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const loadTree = useAppStore((s) => s.loadTree);
  const loadFolder = useAppStore((s) => s.loadFolder);

  const trees = useMemo(() => Array.from(treesMap.values()), [treesMap]);
  const folders = useMemo(() => Array.from(foldersMap.values()), [foldersMap]);
  const [nodeCountsByTreeId, setNodeCountsByTreeId] = useState<Record<string, number>>({});

  type DeleteTarget =
    | { kind: "thread"; id: string; title: string }
    | { kind: "folder"; id: string; name: string; threadCount: number };

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const entries = useMemo(() => {
    const bareThreads: SidebarEntry[] = trees
      .filter((tree) => (tree.folderId ?? null) === null)
      .map((tree) => ({
        kind: "thread" as const,
        id: tree.id,
        activityAt: tree.updatedAt,
        tree,
      }));

    const threadsByFolder = new Map<string, ConversationTree[]>();
    for (const tree of trees) {
      const folderId = tree.folderId ?? null;
      if (!folderId) continue;
      const bucket = threadsByFolder.get(folderId);
      if (bucket) bucket.push(tree);
      else threadsByFolder.set(folderId, [tree]);
    }

    const folderEntries: SidebarEntry[] = folders.map((folder) => {
      const folderThreads = threadsByFolder.get(folder.id) ?? [];
      const latestThreadUpdatedAt = folderThreads.reduce(
        (max, t) => Math.max(max, t.updatedAt),
        -Infinity,
      );
      return {
        kind: "folder" as const,
        id: folder.id,
        activityAt: Math.max(folder.updatedAt, latestThreadUpdatedAt),
        folder,
        threadCount: folderThreads.length,
      };
    });

    return [...folderEntries, ...bareThreads].sort((a, b) => b.activityAt - a.activityAt);
  }, [folders, trees]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextCounts = await computeNodeCountsForTrees(trees);
        if (cancelled) return;
        setNodeCountsByTreeId(nextCounts);
      } catch {
        // ignore count computation failures
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trees]);

  useEffect(() => {
    if (!currentTreeId) return;
    setNodeCountsByTreeId((prev) => {
      if (prev[currentTreeId] === currentNodesCount) return prev;
      return { ...prev, [currentTreeId]: currentNodesCount };
    });
  }, [currentNodesCount, currentTreeId]);

  const confirmDelete = () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    void (async () => {
      try {
        if (deleteTarget.kind === "thread") {
          await deleteTree(deleteTarget.id);
        } else {
          await deleteFolder(deleteTarget.id);
        }
        setDeleteTarget(null);
      } finally {
        setDeleteBusy(false);
      }
    })();
  };

  const deleteTitle =
    deleteTarget?.kind === "folder"
      ? t("sidebar.confirmDeleteFolderTitle")
      : t("sidebar.confirmDeleteThreadTitle");

  const threadNote =
    deleteTarget && deleteTarget.kind === "folder" && deleteTarget.threadCount > 0
      ? t("sidebar.confirmDeleteFolderThreadNote", {
          count: deleteTarget.threadCount,
        })
      : "";

  const deleteDescription =
    deleteTarget && deleteTarget.kind === "folder"
      ? t("sidebar.confirmDeleteFolderBody", {
          name: deleteTarget.name,
          threadNote,
        })
      : deleteTarget && deleteTarget.kind === "thread"
        ? t("sidebar.confirmDeleteThreadBody", { title: deleteTarget.title })
        : null;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-parchment bg-cream">
      <div className="border-b border-parchment px-7 pb-6 pt-8">
        <h1 className="brand-dot flex items-baseline gap-2 font-display text-[1.75rem] font-normal tracking-tight text-ink">
          {t("common.appName")}
        </h1>
        <div className="mt-1 font-mono text-[0.7rem] uppercase tracking-widest text-sand">
          {t("sidebar.tagline")}
        </div>
      </div>

      <div className="mx-5 mt-5 grid grid-cols-2 gap-3">
        <button
          className="flex items-center justify-center gap-2.5 rounded-lg bg-ink px-4 py-3.5 font-body text-[0.85rem] font-medium text-cream transition-all duration-200 hover:-translate-y-px hover:bg-charcoal"
          onClick={() => void createTree()}
        >
          <PlusIcon />
          {t("sidebar.newThread")}
        </button>

        <button
          className="flex items-center justify-center gap-2.5 rounded-lg border border-parchment bg-paper px-4 py-3.5 font-body text-[0.85rem] font-medium text-ink transition-all duration-200 hover:-translate-y-px hover:border-copper hover:bg-copper-glow"
          onClick={() => void createFolder()}
        >
          <FolderIcon />
          {t("sidebar.newFolder")}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-5">
        <div className="mb-3 px-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
          {t("sidebar.library")}
        </div>

        {entries.map((entry) =>
          entry.kind === "folder" ? (
            <FolderItem
              key={entry.id}
              folder={entry.folder}
              threadCount={entry.threadCount}
              activityAt={entry.activityAt}
              isActive={
                (currentView === "folder" && currentFolderId === entry.folder.id) ||
                (currentView === "tree" &&
                  (currentTree?.folderId ?? null) === entry.folder.id)
              }
              onClick={() => loadFolder(entry.folder.id)}
              onDelete={() =>
                setDeleteTarget({
                  kind: "folder",
                  id: entry.folder.id,
                  name: entry.folder.name,
                  threadCount: entry.threadCount,
                })
              }
            />
          ) : (
            <ThreadItem
              key={entry.id}
              tree={entry.tree}
              isActive={currentView === "tree" && currentTreeId === entry.tree.id}
              nodeCount={
                currentView === "tree" && currentTreeId === entry.tree.id
                  ? currentNodesCount
                  : nodeCountsByTreeId[entry.tree.id] ?? null
              }
              onClick={() => void loadTree(entry.tree.id)}
              onDelete={() =>
                setDeleteTarget({
                  kind: "thread",
                  id: entry.tree.id,
                  title: entry.tree.title,
                })
              }
            />
          ),
        )}
      </div>

      <div className="border-t border-parchment p-5">
        <Link
          href="/settings"
          className="flex w-full items-center gap-2.5 rounded-lg border border-parchment bg-transparent px-4 py-3 font-body text-[0.85rem] text-clay transition-all duration-150 hover:border-sand hover:text-ink"
        >
          <SettingsIcon />
          {t("common.settings")}
        </Link>
      </div>

      <ConfirmModal
        open={deleteTarget != null}
        title={deleteTitle}
        description={deleteDescription}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        confirmDisabled={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteTarget(null);
        }}
      />
    </aside>
  );
}
