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
import {
  buildModelSelectionKey,
  getEnabledModelOptions,
  type EnabledModelOption,
} from "@/lib/services/providerModelService";
import { useAppStore } from "@/store/useStore";
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
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [draftModelKeys, setDraftModelKeys] = useState<Set<string>>(new Set());
  const mountedRef = useRef(true);

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
                  placeholder={t("folder.namePlaceholder", { count: 6 })}
                  className="h-[46px] py-0"
                  onChange={(event) => {
                    setName(truncateChars(event.target.value, 6));
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
