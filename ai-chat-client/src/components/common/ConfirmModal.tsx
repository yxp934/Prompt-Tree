"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { useT } from "@/lib/i18n/useT";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText,
  cancelText,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const t = useT();
  const resolvedConfirmText = confirmText ?? t("common.delete");
  const resolvedCancelText = cancelText ?? t("common.cancel");

  return (
    <Modal open={open} title={title} onClose={onClose}>
      {description ? (
        <div className="text-[0.9rem] leading-relaxed text-clay">{description}</div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={confirmDisabled}>
          {resolvedCancelText}
        </Button>
        <Button
          className="bg-[#e74c3c] text-white hover:bg-[#d64533]"
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {resolvedConfirmText}
        </Button>
      </div>
    </Modal>
  );
}
