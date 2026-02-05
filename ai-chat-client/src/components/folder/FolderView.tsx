"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { enUS, zhCN as zhCNLocale } from "date-fns/locale";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/common/Button";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { TrashIcon } from "@/components/common/icons";
import { useT } from "@/lib/i18n/useT";
import { EmbeddingService } from "@/lib/services/embeddingService";
import {
  buildAutoMemoryBlockId,
  buildFolderDocContextBlock,
  buildFolderDocBlockId,
  buildMemoryContextBlock,
  buildPinnedMemoryBlockId,
} from "@/lib/services/longTermMemoryBlocks";
import { renderFolderDocMarkdown } from "@/lib/services/longTermMemoryMarkdown";
import { FolderDocService } from "@/lib/services/folderDocService";
import { MemoryBankService } from "@/lib/services/memoryBankService";
import {
  buildModelSelectionKey,
  getEnabledModelOptions,
  type EnabledModelOption,
} from "@/lib/services/providerModelService";
import { useAppStore } from "@/store/useStore";
import type { JsonObject, MemoryItem, MemoryStatus } from "@/types";
import type { ProviderModelSelection } from "@/types/provider";

import { ThreadCanvasPreview } from "./ThreadCanvasPreview";

function truncateChars(input: string, maxChars: number): string {
  const chars = Array.from(input);
  if (chars.length <= maxChars) return input;
  return chars.slice(0, maxChars).join("");
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function buildSelectionsFromOptions(options: EnabledModelOption[]): ProviderModelSelection[] {
  return options.map((option) => ({ providerId: option.providerId, modelId: option.modelId }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function FolderView() {
  const t = useT();
  const locale = useAppStore((s) => s.locale);
  const folderId = useAppStore((s) => s.currentFolderId);
  const folder = useAppStore((s) => s.getCurrentFolder());
  const folders = useAppStore((s) => s.folders);

  const treesMap = useAppStore((s) => s.trees);
  const loadTree = useAppStore((s) => s.loadTree);
  const createTreeInFolder = useAppStore((s) => s.createTreeInFolder);
  const deleteTree = useAppStore((s) => s.deleteTree);
  const deleteFolder = useAppStore((s) => s.deleteFolder);

  const updateFolderName = useAppStore((s) => s.updateFolderName);
  const updateFolderSystemPrompt = useAppStore((s) => s.updateFolderSystemPrompt);
  const updateFolderEnabledModels = useAppStore((s) => s.updateFolderEnabledModels);
  const updateFolderMemoryRag = useAppStore((s) => s.updateFolderMemoryRag);

  const currentTree = useAppStore((s) => s.getCurrentTree());
  const contextBox = useAppStore((s) => s.contextBox);
  const upsertFileBlock = useAppStore((s) => s.upsertFileBlock);
  const removeFromContext = useAppStore((s) => s.removeFromContext);

  const longTermMemorySettings = useAppStore((s) => s.longTermMemorySettings);

  const providers = useAppStore((s) => s.providers);
  const enabledModelOptions = useMemo(
    () => getEnabledModelOptions(providers),
    [providers],
  );

  const threads = useMemo(() => {
    if (!folderId) return [];
    return Array.from(treesMap.values())
      .filter((tree) => (tree.folderId ?? null) === folderId)
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [folderId, treesMap]);

  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [systemCollapsed, setSystemCollapsed] = useState(false);
  const [modelsCollapsed, setModelsCollapsed] = useState(false);
  const [ragCollapsed, setRagCollapsed] = useState(true);
  const [folderDocCollapsed, setFolderDocCollapsed] = useState(true);
  const [folderMemoriesCollapsed, setFolderMemoriesCollapsed] = useState(true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [draftModelKeys, setDraftModelKeys] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

  const folderDocServiceRef = useRef<FolderDocService | null>(null);
  const memoryBankServiceRef = useRef<MemoryBankService | null>(null);
  const embeddingServiceRef = useRef<EmbeddingService | null>(null);
  if (!folderDocServiceRef.current) folderDocServiceRef.current = new FolderDocService();
  if (!memoryBankServiceRef.current) memoryBankServiceRef.current = new MemoryBankService();
  if (!embeddingServiceRef.current) embeddingServiceRef.current = new EmbeddingService();

  const [ragTopKFolder, setRagTopKFolder] = useState(5);
  const [ragTopKUser, setRagTopKUser] = useState(5);

  const [folderDocDraft, setFolderDocDraft] = useState("");
  const [folderDocMarkdown, setFolderDocMarkdown] = useState("");
  const [folderDocError, setFolderDocError] = useState<string | null>(null);
  const [folderDocSavedAt, setFolderDocSavedAt] = useState<number | null>(null);

  const [folderMemoryQuery, setFolderMemoryQuery] = useState("");
  const [folderMemoryStatus, setFolderMemoryStatus] = useState<MemoryStatus | "all">("active");
  const [folderMemoriesLoading, setFolderMemoriesLoading] = useState(false);
  const [folderMemories, setFolderMemories] = useState<MemoryItem[]>([]);
  const [folderMemoriesError, setFolderMemoriesError] = useState<string | null>(null);

  const [editMemoryOpen, setEditMemoryOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null);
  const [editMemoryText, setEditMemoryText] = useState("");
  const [editMemoryTags, setEditMemoryTags] = useState("");
  const [editMemoryError, setEditMemoryError] = useState<string | null>(null);
  const [editMemoryBusy, setEditMemoryBusy] = useState(false);

  type DeleteTarget =
    | { kind: "thread"; id: string; title: string }
    | { kind: "folder"; id: string; name: string; threadCount: number };

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setName(folder?.name ?? "");
    setSystemPrompt(folder?.systemPrompt ?? "");
  }, [folder?.id, folder?.name, folder?.systemPrompt]);

  useEffect(() => {
    setRagTopKFolder(folder?.memoryRag?.topKFolder ?? 5);
    setRagTopKUser(folder?.memoryRag?.topKUser ?? 5);
  }, [folder?.id, folder?.memoryRag?.topKFolder, folder?.memoryRag?.topKUser]);

  useEffect(() => {
    if (!folderId) return;
    let cancelled = false;

    void (async () => {
      try {
        const doc = await folderDocServiceRef.current!.read(folderId);
        if (cancelled) return;
        setFolderDocDraft(JSON.stringify(doc.data, null, 2));
        setFolderDocMarkdown(renderFolderDocMarkdown(doc));
        setFolderDocError(null);
      } catch (err) {
        if (cancelled) return;
        setFolderDocError(err instanceof Error ? err.message : "Failed to load folder doc.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [folderId]);

  const projectEnabledOptions = useMemo(() => {
    if (!folder) return [];
    if (folder.enabledModels == null) return enabledModelOptions;
    const keys = new Set(folder.enabledModels.map(buildModelSelectionKey));
    return enabledModelOptions.filter((option) => keys.has(buildModelSelectionKey(option)));
  }, [enabledModelOptions, folder]);

  const projectEnabledLabel = useMemo(() => {
    if (!folder) return "";
    if (folder.enabledModels == null) return t("folder.models.allEnabled");
    if (projectEnabledOptions.length === 0) return t("folder.models.none");
    return t("folder.models.selectedCount", { count: projectEnabledOptions.length });
  }, [folder, projectEnabledOptions.length, t]);

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

  const reloadFolderMemories = async () => {
    if (!folderId) return;
    setFolderMemoriesLoading(true);
    setFolderMemoriesError(null);
    try {
      const list = await memoryBankServiceRef.current!.list({
        scope: "folder",
        folderId,
        ...(folderMemoryStatus === "all" ? {} : { status: folderMemoryStatus }),
      });
      setFolderMemories(list);
    } catch (err) {
      setFolderMemoriesError(err instanceof Error ? err.message : "Failed to load folder memories.");
    } finally {
      setFolderMemoriesLoading(false);
    }
  };

  useEffect(() => {
    void reloadFolderMemories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, folderMemoryStatus]);

  const filteredFolderMemories = useMemo(() => {
    const q = folderMemoryQuery.trim().toLowerCase();
    if (!q) return folderMemories;
    return folderMemories.filter((m) => {
      const haystack = `${m.text}\n${m.tags.join(" ")}\n${m.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [folderMemories, folderMemoryQuery]);

  const openEditMemory = (item: MemoryItem) => {
    setEditingMemory(item);
    setEditMemoryText(item.text);
    setEditMemoryTags(item.tags.join(", "));
    setEditMemoryError(null);
    setEditMemoryOpen(true);
  };

  const closeEditMemory = () => {
    if (editMemoryBusy) return;
    setEditMemoryOpen(false);
    setEditingMemory(null);
  };

  const parseTags = (input: string): string[] =>
    input
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const refreshMemoryBlocksInContext = async (updated: MemoryItem) => {
    if (!currentTree || !contextBox) return;
    const autoId = buildAutoMemoryBlockId(updated.id);
    const pinId = buildPinnedMemoryBlockId(updated.id);
    const hasPin = contextBox.blocks.some((b) => b.kind === "file" && b.id === pinId);
    const hasAuto = contextBox.blocks.some((b) => b.kind === "file" && b.id === autoId);
    if (!hasPin && !hasAuto) return;
    if (hasPin && hasAuto) removeFromContext(autoId);
    await upsertFileBlock(
      buildMemoryContextBlock({ item: updated, pinned: hasPin }),
      currentTree.rootId,
    );
  };

  const saveEditedMemory = async () => {
    if (!editingMemory || editMemoryBusy) return;
    setEditMemoryBusy(true);
    setEditMemoryError(null);
    try {
      const text = editMemoryText.trim();
      const tags = parseTags(editMemoryTags);
      if (!text || tags.length === 0) {
        setEditMemoryError(t("settings.memory.memories.editor.invalid"));
        return;
      }
      const updated = await memoryBankServiceRef.current!.edit({
        id: editingMemory.id,
        text,
        tags,
      });
      await refreshMemoryBlocksInContext(updated);
      await reloadFolderMemories();
      setEditMemoryOpen(false);
      setEditingMemory(null);
    } catch (err) {
      setEditMemoryError(err instanceof Error ? err.message : "Failed to save memory.");
    } finally {
      setEditMemoryBusy(false);
    }
  };

  const deleteFolderMemory = async (item: MemoryItem) => {
    try {
      await memoryBankServiceRef.current!.softDelete(item.id);
      removeFromContext(buildAutoMemoryBlockId(item.id));
      removeFromContext(buildPinnedMemoryBlockId(item.id));
      await reloadFolderMemories();
    } catch (err) {
      setFolderMemoriesError(err instanceof Error ? err.message : "Failed to delete memory.");
    }
  };

  const restoreFolderMemory = async (item: MemoryItem) => {
    try {
      await memoryBankServiceRef.current!.restore(item.id);
      await reloadFolderMemories();
    } catch (err) {
      setFolderMemoriesError(err instanceof Error ? err.message : "Failed to restore memory.");
    }
  };

  const [reembedBusy, setReembedBusy] = useState(false);
  const reembedMemory = async (item: MemoryItem) => {
    const selection = longTermMemorySettings.embeddingModel;
    if (!selection) return;
    setReembedBusy(true);
    try {
      const res = await embeddingServiceRef.current!.embedWithSelection({
        providers,
        selection,
        text: item.text,
      });
      if (!res) throw new Error(t("errors.missingApiKey"));
      await memoryBankServiceRef.current!.updateEmbedding({
        id: item.id,
        embedding: res.embedding,
        embeddingModelKey: res.embeddingModelKey,
      });
      await reloadFolderMemories();
      setFolderMemoriesError(null);
    } catch (err) {
      setFolderMemoriesError(err instanceof Error ? err.message : "Embedding failed.");
    } finally {
      setReembedBusy(false);
    }
  };

  const saveFolderDoc = async () => {
    if (!folderId) return;
    setFolderDocError(null);

    try {
      const raw = JSON.parse(folderDocDraft) as unknown;
      if (!isRecord(raw)) {
        setFolderDocError(t("folder.folderDoc.invalidJson"));
        return;
      }

      const updated = await folderDocServiceRef.current!.replaceData(folderId, raw as JsonObject);
      setFolderDocDraft(JSON.stringify(updated.data, null, 2));
      const markdown = renderFolderDocMarkdown(updated);
      setFolderDocMarkdown(markdown);
      setFolderDocSavedAt(Date.now());

      const folderBlockId = buildFolderDocBlockId(folderId);
      const hasBlock =
        contextBox?.blocks.some((b) => b.kind === "file" && b.id === folderBlockId) ?? false;
      if (currentTree && currentTree.folderId === folderId && hasBlock) {
        await upsertFileBlock(
          buildFolderDocContextBlock({ folderId, markdown }),
          currentTree.rootId,
        );
      }
    } catch (err) {
      setFolderDocError(err instanceof Error ? err.message : t("folder.folderDoc.invalidJson"));
    }
  };

  const openModelPicker = () => {
    if (!folder) return;
    const initial =
      folder.enabledModels == null
        ? new Set(enabledModelOptions.map(buildModelSelectionKey))
        : new Set(folder.enabledModels.map(buildModelSelectionKey));
    setDraftModelKeys(initial);
    setModelPickerOpen(true);
  };

  const toggleDraftModel = (option: EnabledModelOption) => {
    const key = buildModelSelectionKey(option);
    setDraftModelKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const saveModelPicker = () => {
    if (!folder) return;
    const totalKeys = new Set(enabledModelOptions.map(buildModelSelectionKey));
    const selected = Array.from(draftModelKeys).filter((key) => totalKeys.has(key));

    const selectedOptions = enabledModelOptions.filter((option) =>
      draftModelKeys.has(buildModelSelectionKey(option)),
    );
    const selections = buildSelectionsFromOptions(selectedOptions);

    const storedValue = selected.length === totalKeys.size ? null : selections;
    void updateFolderEnabledModels(folder.id, storedValue);
    setModelPickerOpen(false);
  };

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
        if (mountedRef.current) setDeleteTarget(null);
      } finally {
        if (mountedRef.current) setDeleteBusy(false);
      }
    })();
  };

  if (!folderId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-10 text-sand">
        {t("folder.empty.selectFolder")}
      </div>
    );
  }

  if (!folder && !folders.has(folderId)) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-10 text-sand">
        {t("folder.empty.notFound")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-paper">
      <div className="border-b border-parchment bg-paper px-6 py-6 lg:px-8">
        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
              {t("folder.label")}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <Input
                  value={name}
                  placeholder={t("folder.namePlaceholder", { count: 20 })}
                  className="h-[46px] py-0"
                  onChange={(event) => {
                    setName(truncateChars(event.target.value, 20));
                  }}
                  onBlur={() => {
                    if (!folder) return;
                    if (name === folder.name) return;
                    void updateFolderName(folder.id, name);
                  }}
                />
              </div>

              <Button
                className="h-[46px] shrink-0 gap-2 px-5"
                onClick={() => void createTreeInFolder(folderId)}
              >
                <PlusIcon />
                {t("folder.newThread")}
              </Button>

              <Button
                variant="secondary"
                className="h-[46px] shrink-0 gap-2 px-5 border-[#e74c3c]/40 text-[#e74c3c] hover:border-[#e74c3c] hover:bg-[#e74c3c]/10"
                onClick={() => {
                  if (!folder) return;
                  setDeleteTarget({
                    kind: "folder",
                    id: folder.id,
                    name: folder.name,
                    threadCount: threads.length,
                  });
                }}
              >
                <TrashIcon />
                {t("folder.deleteFolder")}
              </Button>
            </div>
          </div>

	          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-parchment bg-cream p-4 shadow-[0_10px_28px_rgba(26,24,22,0.06)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setSystemCollapsed((prev) => !prev)}
              >
                <div>
                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
                    {t("folder.systemPrompt.title")}
                  </div>
                  {systemCollapsed ? (
                    <div className="mt-1 line-clamp-1 text-[0.85rem] text-clay">
                      {systemPrompt.trim()
                        ? systemPrompt.trim()
                        : t("folder.systemPrompt.collapsedEmpty")}
                    </div>
                  ) : null}
                </div>
                <div className="text-sand">
                  <ChevronIcon open={!systemCollapsed} />
                </div>
              </button>

              {!systemCollapsed ? (
                <div className="mt-3">
                  <textarea
                    value={systemPrompt}
                    placeholder={t("folder.systemPrompt.placeholder")}
                    onChange={(event) => setSystemPrompt(event.target.value)}
                    onBlur={() => {
                      if (!folder) return;
                      if (systemPrompt === folder.systemPrompt) return;
                      void updateFolderSystemPrompt(folder.id, systemPrompt);
                    }}
                    className="min-h-[120px] w-full resize-none rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] leading-relaxed text-ink outline-none transition-all duration-200 placeholder:text-sand focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
                  />
                  <div className="mt-2 font-mono text-[0.7rem] text-sand">
                    {t("folder.systemPrompt.note")}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-parchment bg-cream p-4 shadow-[0_10px_28px_rgba(26,24,22,0.06)]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setModelsCollapsed((prev) => !prev)}
              >
                <div>
                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
                    {t("folder.models.title")}
                  </div>
                  {modelsCollapsed ? (
                    <div className="mt-1 text-[0.85rem] text-clay">
                      {projectEnabledLabel}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 text-sand">
                  <span className="rounded-full border border-parchment bg-paper px-2 py-0.5 font-mono text-[0.65rem] text-clay">
                    {projectEnabledOptions.length}
                  </span>
                  <ChevronIcon open={!modelsCollapsed} />
                </div>
              </button>

              {!modelsCollapsed ? (
                <div className="mt-3">
                  {enabledModelOptions.length === 0 ? (
                    <div className="rounded-xl border border-parchment bg-paper p-4 text-[0.85rem] text-clay">
                      {t("folder.models.noneEnabled")}{" "}
                      <Link
                        href="/settings"
                        className="text-ink underline underline-offset-2"
                      >
                        {t("folder.models.configureInSettings")}
                      </Link>
                      .
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-mono text-[0.7rem] text-sand">
                          {t("folder.models.help")}
                        </div>
                        <button
                          type="button"
                          className="rounded-lg border border-parchment bg-paper px-3 py-2 text-[0.75rem] text-ink transition-all duration-150 hover:border-copper hover:bg-copper-glow"
                          onClick={(event) => {
                            event.stopPropagation();
                            openModelPicker();
                          }}
                        >
                          {t("common.edit")}
                        </button>
                      </div>

                      <button
                        type="button"
                        className="flex w-full flex-wrap gap-2 rounded-xl border border-parchment bg-paper p-4 text-left transition-all duration-150 hover:border-copper"
                        onClick={() => openModelPicker()}
                      >
                        {projectEnabledOptions.length === 0 ? (
                          <span className="text-[0.85rem] text-clay">
                            {t("folder.models.noneSelected")}
                          </span>
                        ) : (
                          projectEnabledOptions.map((option) => (
                            <span
                              key={`${option.providerId}:${option.modelId}`}
                              className="rounded-full border border-parchment bg-cream px-3 py-1 font-mono text-[0.7rem] text-ink"
                              title={option.label}
                            >
                              {option.label}
                            </span>
                          ))
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
	            </div>
	          </div>

	          <div className="grid gap-4 lg:grid-cols-2">
	            <div className="rounded-2xl border border-parchment bg-cream p-4 shadow-[0_10px_28px_rgba(26,24,22,0.06)]">
	              <button
	                type="button"
	                className="flex w-full items-center justify-between gap-3 text-left"
	                onClick={() => setRagCollapsed((prev) => !prev)}
	              >
	                <div>
	                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
	                    {t("folder.memoryRag.title")}
	                  </div>
	                  {ragCollapsed ? (
	                    <div className="mt-1 text-[0.85rem] text-clay">
	                      {t("folder.memoryRag.summary", {
	                        folder: ragTopKFolder,
	                        user: ragTopKUser,
	                      })}
	                    </div>
	                  ) : null}
	                </div>
	                <div className="text-sand">
	                  <ChevronIcon open={!ragCollapsed} />
	                </div>
	              </button>

	              {!ragCollapsed ? (
	                <div className="mt-4 space-y-4">
	                  <div className="grid gap-4 md:grid-cols-2">
	                    <label className="space-y-2">
	                      <div className="font-mono text-[0.7rem] text-sand">
	                        {t("folder.memoryRag.topKFolder")}
	                      </div>
	                      <input
	                        type="number"
	                        min={0}
	                        max={20}
	                        className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
	                        value={ragTopKFolder}
	                        onChange={(e) => setRagTopKFolder(Number(e.target.value))}
	                        onBlur={() => {
	                          if (!folder) return;
	                          const nextFolder = Math.max(0, Math.min(20, Math.round(ragTopKFolder || 0)));
	                          const nextUser = Math.max(0, Math.min(20, Math.round(ragTopKUser || 0)));
	                          setRagTopKFolder(nextFolder);
	                          setRagTopKUser(nextUser);
	                          const currentFolder = folder.memoryRag?.topKFolder ?? 5;
	                          const currentUser = folder.memoryRag?.topKUser ?? 5;
	                          if (nextFolder === currentFolder && nextUser === currentUser) return;
	                          void updateFolderMemoryRag(folder.id, { topKFolder: nextFolder, topKUser: nextUser });
	                        }}
	                      />
	                    </label>

	                    <label className="space-y-2">
	                      <div className="font-mono text-[0.7rem] text-sand">
	                        {t("folder.memoryRag.topKUser")}
	                      </div>
	                      <input
	                        type="number"
	                        min={0}
	                        max={20}
	                        className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
	                        value={ragTopKUser}
	                        onChange={(e) => setRagTopKUser(Number(e.target.value))}
	                        onBlur={() => {
	                          if (!folder) return;
	                          const nextFolder = Math.max(0, Math.min(20, Math.round(ragTopKFolder || 0)));
	                          const nextUser = Math.max(0, Math.min(20, Math.round(ragTopKUser || 0)));
	                          setRagTopKFolder(nextFolder);
	                          setRagTopKUser(nextUser);
	                          const currentFolder = folder.memoryRag?.topKFolder ?? 5;
	                          const currentUser = folder.memoryRag?.topKUser ?? 5;
	                          if (nextFolder === currentFolder && nextUser === currentUser) return;
	                          void updateFolderMemoryRag(folder.id, { topKFolder: nextFolder, topKUser: nextUser });
	                        }}
	                      />
	                    </label>
	                  </div>

	                  <div className="font-mono text-[0.7rem] text-sand">
	                    {t("folder.memoryRag.note")}
	                  </div>
	                </div>
	              ) : null}
	            </div>

	            <div className="rounded-2xl border border-parchment bg-cream p-4 shadow-[0_10px_28px_rgba(26,24,22,0.06)]">
	              <button
	                type="button"
	                className="flex w-full items-center justify-between gap-3 text-left"
	                onClick={() => setFolderDocCollapsed((prev) => !prev)}
	              >
	                <div>
	                  <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
	                    {t("folder.folderDoc.title")}
	                  </div>
	                  {folderDocCollapsed ? (
	                    <div className="mt-1 line-clamp-1 text-[0.85rem] text-clay">
	                      {folderDocMarkdown.trim() ? folderDocMarkdown.split("\n")[0] : "…"}
	                    </div>
	                  ) : null}
	                </div>
	                <div className="text-sand">
	                  <ChevronIcon open={!folderDocCollapsed} />
	                </div>
	              </button>

	              {!folderDocCollapsed ? (
	                <div className="mt-4 space-y-4">
	                  <div className="flex flex-wrap items-center justify-between gap-3">
	                    <div className="font-mono text-[0.7rem] text-sand">
	                      {folderDocSavedAt ? new Date(folderDocSavedAt).toLocaleString(locale) : ""}
	                    </div>
	                    <button
	                      type="button"
	                      className="rounded-lg bg-matcha-green px-4 py-2 text-sm text-shoji-white transition-all duration-200 hover:bg-matcha-green/90"
	                      onClick={() => void saveFolderDoc()}
	                    >
	                      {t("folder.folderDoc.save")}
	                    </button>
	                  </div>

	                  {folderDocError ? (
	                    <div className="rounded-xl border border-[#e74c3c]/30 bg-[#e74c3c]/10 p-3 text-sm text-[#b1382c]">
	                      {folderDocError}
	                    </div>
	                  ) : null}

	                  <div className="grid gap-4 md:grid-cols-2">
	                    <label className="space-y-2">
	                      <div className="font-mono text-[0.7rem] text-sand">
	                        {t("folder.folderDoc.json")}
	                      </div>
	                      <textarea
	                        value={folderDocDraft}
	                        onChange={(e) => setFolderDocDraft(e.target.value)}
	                        className="min-h-[220px] w-full resize-none rounded-xl border border-parchment bg-paper px-4 py-3 font-mono text-[0.75rem] leading-relaxed text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
	                      />
	                    </label>

	                    <div className="space-y-2">
	                      <div className="font-mono text-[0.7rem] text-sand">
	                        {t("folder.folderDoc.markdown")}
	                      </div>
	                      <pre className="min-h-[220px] overflow-auto rounded-xl border border-parchment bg-paper p-4 font-mono text-[0.75rem] text-ink">
	                        {folderDocMarkdown}
	                      </pre>
	                    </div>
	                  </div>
	                </div>
	              ) : null}
	            </div>
	          </div>

	          <div className="rounded-2xl border border-parchment bg-cream p-4 shadow-[0_10px_28px_rgba(26,24,22,0.06)]">
	            <button
	              type="button"
	              className="flex w-full items-center justify-between gap-3 text-left"
	              onClick={() => setFolderMemoriesCollapsed((prev) => !prev)}
	            >
	              <div>
	                <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
	                  {t("folder.folderMemories.title")}
	                </div>
	                {folderMemoriesCollapsed ? (
	                  <div className="mt-1 text-[0.85rem] text-clay">
	                    {folderMemoriesLoading
	                      ? t("common.loading")
	                      : t("folder.folderMemories.summary", {
	                          count: filteredFolderMemories.length,
	                          total: folderMemories.length,
	                        })}
	                  </div>
	                ) : null}
	              </div>
	              <div className="text-sand">
	                <ChevronIcon open={!folderMemoriesCollapsed} />
	              </div>
	            </button>

	            {!folderMemoriesCollapsed ? (
	              <div className="mt-4 space-y-4">
	                <div className="grid gap-4 md:grid-cols-3">
	                  <input
	                    className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)] md:col-span-1"
	                    value={folderMemoryQuery}
	                    placeholder={t("folder.folderMemories.searchPlaceholder")}
	                    onChange={(e) => setFolderMemoryQuery(e.target.value)}
	                  />

	                  <select
	                    className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
	                    value={folderMemoryStatus}
	                    onChange={(e) =>
	                      setFolderMemoryStatus(
	                        e.target.value === "deleted"
	                          ? "deleted"
	                          : e.target.value === "superseded"
	                            ? "superseded"
	                            : e.target.value === "active"
	                              ? "active"
	                              : "all",
	                      )
	                    }
	                  >
	                    <option value="all">{t("settings.memory.memories.status.all")}</option>
	                    <option value="active">{t("settings.memory.memories.status.active")}</option>
	                    <option value="deleted">{t("settings.memory.memories.status.deleted")}</option>
	                    <option value="superseded">{t("settings.memory.memories.status.superseded")}</option>
	                  </select>

	                  <button
	                    type="button"
	                    className="rounded-lg border border-parchment bg-paper px-3 py-2 text-[0.85rem] text-ink transition-all duration-150 hover:border-copper hover:bg-copper-glow disabled:cursor-not-allowed disabled:opacity-50"
	                    onClick={() => void reloadFolderMemories()}
	                    disabled={folderMemoriesLoading}
	                  >
	                    {t("common.refresh")}
	                  </button>
	                </div>

	                {folderMemoriesError ? (
	                  <div className="rounded-xl border border-[#e74c3c]/30 bg-[#e74c3c]/10 p-3 text-sm text-[#b1382c]">
	                    {folderMemoriesError}
	                  </div>
	                ) : null}

	                {filteredFolderMemories.length === 0 ? (
	                  <div className="rounded-xl border border-parchment bg-paper p-4 text-[0.85rem] text-clay">
	                    {t("folder.folderMemories.empty")}
	                  </div>
	                ) : (
	                  <div className="space-y-3">
	                    {filteredFolderMemories.map((m) => (
	                      <div
	                        key={m.id}
	                        className="rounded-2xl border border-parchment bg-paper p-4"
	                      >
	                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3 font-mono text-[0.7rem] text-sand">
	                          <span>{m.status}</span>
	                          <span>{new Date(m.updatedAt).toLocaleString(locale)}</span>
	                        </div>

	                        <div className="line-clamp-3 whitespace-pre-wrap text-[0.9rem] leading-relaxed text-ink">
	                          {m.text}
	                        </div>

	                        {m.tags.length ? (
	                          <div className="mt-3 flex flex-wrap gap-2">
	                            {m.tags.slice(0, 8).map((tag) => (
	                              <span
	                                key={tag}
	                                className="rounded-full border border-parchment bg-cream px-3 py-1 font-mono text-[0.65rem] text-ink"
	                              >
	                                {tag}
	                              </span>
	                            ))}
	                          </div>
	                        ) : null}

	                        <div className="mt-4 flex flex-wrap items-center gap-2">
	                          <button
	                            type="button"
	                            className="rounded-lg border border-parchment bg-cream px-3 py-2 text-[0.8rem] text-ink transition-all duration-150 hover:border-copper hover:bg-copper-glow"
	                            onClick={() => openEditMemory(m)}
	                          >
	                            {t("common.edit")}
	                          </button>

	                          {m.status === "deleted" ? (
	                            <button
	                              type="button"
	                              className="rounded-lg border border-parchment bg-cream px-3 py-2 text-[0.8rem] text-ink transition-all duration-150 hover:border-copper hover:bg-copper-glow"
	                              onClick={() => void restoreFolderMemory(m)}
	                            >
	                              {t("settings.memory.memories.restore")}
	                            </button>
	                          ) : (
	                            <button
	                              type="button"
	                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[0.8rem] text-red-600 transition-all duration-150 hover:bg-red-100"
	                              onClick={() => void deleteFolderMemory(m)}
	                            >
	                              {t("settings.memory.memories.delete")}
	                            </button>
	                          )}

	                          {longTermMemorySettings.embeddingModel ? (
	                            <button
	                              type="button"
	                              className="rounded-lg border border-parchment bg-cream px-3 py-2 text-[0.8rem] text-ink transition-all duration-150 hover:border-copper hover:bg-copper-glow disabled:cursor-not-allowed disabled:opacity-50"
	                              disabled={reembedBusy}
	                              onClick={() => void reembedMemory(m)}
	                            >
	                              {t("settings.memory.memories.reembed")}
	                            </button>
	                          ) : null}
	                        </div>
	                      </div>
	                    ))}
	                  </div>
	                )}
	              </div>
	            ) : null}
	          </div>
	        </div>
	      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-parchment bg-paper/50 px-6 py-3 lg:px-8">
          <div className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-sand">
            {t("folder.threads.title", { count: threads.length })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          {threads.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-parchment bg-cream p-10 text-center">
              <div className="font-display text-[1.2rem] text-ink">
                {t("folder.threads.empty.title")}
              </div>
              <div className="max-w-[42ch] text-[0.9rem] leading-relaxed text-clay">
                {t("folder.threads.empty.description")}
              </div>
              <Button
                className="gap-2"
                onClick={() => void createTreeInFolder(folderId)}
              >
                <PlusIcon />
                {t("folder.threads.empty.action")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map((tree) => {
                const timeAgo = formatDistanceToNow(new Date(tree.updatedAt), {
                  addSuffix: true,
                  locale: locale === "zh-CN" ? zhCNLocale : enUS,
                });
                return (
                  <div key={tree.id} className="group relative">
                    <button
                      type="button"
                      className="flex w-full items-stretch justify-between gap-5 rounded-2xl border border-parchment bg-paper p-4 text-left shadow-[0_8px_24px_rgba(26,24,22,0.05)] transition-all duration-200 hover:-translate-y-px hover:border-copper hover:shadow-[0_14px_38px_rgba(184,115,51,0.12)]"
                      onClick={() => void loadTree(tree.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-start justify-between gap-3">
                          <div className="truncate text-[0.95rem] font-medium text-ink">
                            {tree.title}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 font-mono text-[0.7rem] text-sand">
                          <span>{timeAgo}</span>
                          <span className="opacity-70">id: {tree.id.slice(0, 8)}</span>
                        </div>
                      </div>

                      <ThreadCanvasPreview
                        treeId={tree.id}
                        rootId={tree.rootId}
                        revision={tree.updatedAt}
                        className="shrink-0"
                      />
                    </button>

                    <button
                      type="button"
                      className="absolute right-4 top-4 z-10 rounded-md p-1 text-sand opacity-0 transition-all duration-150 hover:bg-paper hover:text-[#e74c3c] group-hover:opacity-100"
                      aria-label={t("folder.deleteThreadAria")}
                      onClick={() =>
                        setDeleteTarget({
                          kind: "thread",
                          id: tree.id,
                          title: tree.title,
                        })
                      }
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={modelPickerOpen}
        title={t("folder.models.picker.title")}
        onClose={() => setModelPickerOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[0.7rem] text-sand">
              {t("folder.models.picker.description")}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-parchment bg-paper px-3 py-2 text-[0.75rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink"
                onClick={() =>
                  setDraftModelKeys(
                    new Set(enabledModelOptions.map(buildModelSelectionKey)),
                  )
                }
              >
                {t("common.selectAll")}
              </button>
              <button
                type="button"
                className="rounded-lg border border-parchment bg-paper px-3 py-2 text-[0.75rem] text-sand transition-all duration-150 hover:border-copper hover:text-ink"
                onClick={() => setDraftModelKeys(new Set())}
              >
                {t("common.clear")}
              </button>
            </div>
          </div>

          <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-xl border border-parchment bg-paper p-3">
            {enabledModelOptions.map((option) => {
              const key = buildModelSelectionKey(option);
              const checked = draftModelKeys.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${
                    checked
                      ? "border-copper/50 bg-copper/10"
                      : "border-parchment/30 bg-shoji-white hover:border-copper/40"
                  }`}
                  onClick={() => toggleDraftModel(option)}
                >
                  <span
                    className={`flex h-4.5 w-4.5 items-center justify-center rounded border text-[0.6rem] ${
                      checked
                        ? "border-copper bg-copper text-white"
                        : "border-parchment bg-transparent text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <div className="flex-1">
                    <div className="font-mono text-[0.8rem] text-ink">
                      {option.modelId}
                    </div>
                    <div className="text-[0.65rem] text-sand">
                      {option.providerName}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <div className="font-mono text-[0.75rem] text-sand">
              {t("folder.models.picker.selected")}{" "}
              <span className="font-medium text-ink">{draftModelKeys.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setModelPickerOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={saveModelPicker}>{t("common.save")}</Button>
            </div>
          </div>
        </div>
	      </Modal>

	      <Modal
	        open={editMemoryOpen}
	        title={t("settings.memory.memories.editor.title")}
	        onClose={closeEditMemory}
	      >
	        <div className="space-y-4">
	          {editMemoryError ? (
	            <div className="rounded-xl border border-[#e74c3c]/30 bg-[#e74c3c]/10 p-3 text-sm text-[#b1382c]">
	              {editMemoryError}
	            </div>
	          ) : null}

	          <label className="space-y-2">
	            <div className="font-mono text-[0.7rem] text-sand">
	              {t("settings.memory.memories.editor.text")}
	            </div>
	            <textarea
	              value={editMemoryText}
	              onChange={(e) => setEditMemoryText(e.target.value)}
	              className="min-h-[160px] w-full resize-none rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] leading-relaxed text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
	            />
	          </label>

	          <label className="space-y-2">
	            <div className="font-mono text-[0.7rem] text-sand">
	              {t("settings.memory.memories.editor.tags")}
	            </div>
	            <input
	              value={editMemoryTags}
	              onChange={(e) => setEditMemoryTags(e.target.value)}
	              className="w-full rounded-xl border border-parchment bg-paper px-4 py-3 font-body text-[0.9rem] text-ink outline-none transition-all duration-200 focus:border-copper focus:shadow-[0_0_0_3px_var(--copper-glow)]"
	            />
	          </label>

	          <div className="flex items-center justify-end gap-2 pt-2">
	            <Button variant="secondary" onClick={closeEditMemory} disabled={editMemoryBusy}>
	              {t("common.cancel")}
	            </Button>
	            <Button onClick={() => void saveEditedMemory()} disabled={editMemoryBusy}>
	              {editMemoryBusy ? t("common.loading") : t("common.save")}
	            </Button>
	          </div>
	        </div>
	      </Modal>

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
    </div>
  );
}
