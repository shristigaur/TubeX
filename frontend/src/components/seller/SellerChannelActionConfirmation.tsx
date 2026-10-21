import React, { useEffect, useRef } from 'react';

export type ConfirmationVariant = 'danger' | 'warning' | 'primary';

export interface SellerChannelActionConfirmationProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_CONFIGS = {
  danger: {
    iconBg: 'bg-rose-950/60 text-rose-400 border-rose-500/30',
    confirmBtn:
      'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30 focus-visible:outline-rose-500',
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    ),
  },
  warning: {
    iconBg: 'bg-amber-950/60 text-amber-400 border-amber-500/30',
    confirmBtn:
      'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30 focus-visible:outline-amber-500',
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    ),
  },
  primary: {
    iconBg: 'bg-cyan-950/60 text-cyan-400 border-cyan-500/30',
    confirmBtn:
      'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-cyan-900/30 focus-visible:outline-cyan-400',
    iconPath: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
};

/**
 * Accessible confirmation dialog for lifecycle and destructive seller actions
 * (e.g., submitting for review, unpublishing, permanent listing deletion).
 * Emits onConfirm / onCancel callbacks and does not execute API requests directly.
 */
export function SellerChannelActionConfirmation({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}: SellerChannelActionConfirmationProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onCancel]);

  // Auto-focus the confirm button when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const vConfig = VARIANT_CONFIGS[variant] ?? VARIANT_CONFIGS.primary;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-modal-title"
      aria-describedby="confirmation-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      {/* Backdrop overlay with blur */}
      <div
        aria-hidden="true"
        onClick={!isLoading ? onCancel : undefined}
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl shadow-blue-950/40 backdrop-blur-md transition-all">
        <div className="flex items-start gap-4">
          {/* Variant Icon */}
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${vConfig.iconBg}`}
          >
            <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {vConfig.iconPath}
            </svg>
          </div>

          <div className="flex-1">
            <h3
              id="confirmation-modal-title"
              className="text-lg font-semibold tracking-tight text-white"
            >
              {title}
            </h3>
            <p
              id="confirmation-modal-desc"
              className="mt-2 text-xs leading-relaxed text-slate-300"
            >
              {description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${vConfig.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
