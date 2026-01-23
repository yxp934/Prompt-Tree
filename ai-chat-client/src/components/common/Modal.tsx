"use client";

import { useEffect, type ReactNode } from "react";

export interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ open, title, children, onClose }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <button
        className="absolute inset-0 bg-ink/30"
        aria-label="Close modal"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[520px] rounded-2xl border border-parchment bg-cream p-6 shadow-[0_22px_60px_rgba(35,31,28,0.18)]">
        <div className="mb-4 font-display text-[1.15rem] text-ink">
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}
