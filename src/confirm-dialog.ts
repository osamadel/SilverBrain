import { t } from "./i18n";

export type ConfirmDialogOpts = {
  titleKey: string;
  messageKey: string;
  messageVars?: Record<string, string | number>;
  confirmKey?: string;
  /** Button classes for the confirm action. Defaults to destructive styling. */
  confirmClass?: string;
  onConfirm: () => void;
};

let pendingConfirm: (() => void) | null = null;

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export function isConfirmDialogOpen(): boolean {
  return !$("confirmBackdrop").classList.contains("hidden");
}

export function closeConfirmDialog(): void {
  $("confirmBackdrop").classList.add("hidden");
  pendingConfirm = null;
}

export function showConfirmDialog(opts: ConfirmDialogOpts): void {
  $("confirmTitle").textContent = t(opts.titleKey);
  $("confirmMessage").textContent = t(opts.messageKey, opts.messageVars);
  $("confirmOkBtn").textContent = t(opts.confirmKey ?? "btn-delete");
  $("confirmOkBtn").className = opts.confirmClass ?? "btn-danger btn-auto";
  $("confirmCancelBtn").textContent = t("btn-cancel");
  pendingConfirm = opts.onConfirm;
  $("confirmBackdrop").classList.remove("hidden");
  $("confirmOkBtn").focus();
}

export function confirmDialogAction(): void {
  const cb = pendingConfirm;
  closeConfirmDialog();
  cb?.();
}

export function initConfirmDialog(): void {
  $("confirmCancelBtn").onclick = closeConfirmDialog;
  $("confirmCloseBtn").onclick = closeConfirmDialog;
  $("confirmBackdrop").addEventListener("click", function (e) {
    if (e.target === this) closeConfirmDialog();
  });
  $("confirmOkBtn").onclick = confirmDialogAction;
}
