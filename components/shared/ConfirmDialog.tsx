"use client";

import { useEffect } from "react";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  /** When true, only show the cancel/close button (no confirm button). */
  hideConfirm?: boolean;
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  hideConfirm = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const confirmBtnBase =
    "rounded-lg px-4 py-2 font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]";
  const confirmButtonClass =
    variant === "danger"
      ? `${confirmBtnBase} bg-red-600 hover:bg-red-700 focus:ring-red-500`
      : `${confirmBtnBase} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-xl">
        <h2
          id="confirm-dialog-title"
          className="text-lg font-semibold text-[#f5f5f5]"
        >
          {title}
        </h2>
        <p id="confirm-dialog-desc" className="mt-2 text-sm text-gray-400">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2a2a2a] bg-[#0f0f0f] px-4 py-2 font-medium text-gray-300 hover:bg-[#2a2a2a] focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a]"
          >
            {cancelLabel}
          </button>
          {!hideConfirm && (
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={confirmButtonClass}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
