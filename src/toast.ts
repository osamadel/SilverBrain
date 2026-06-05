// In-app toast stack for warnings, errors, and brief success feedback.

import { t } from "./i18n";

export type ToastType = "warning" | "error" | "success" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
  /** Re-translate label on applyLanguage when set */
  labelKey?: string;
}

export interface ShowToastOptions {
  id?: string;
  message: string;
  type?: ToastType;
  action?: ToastAction;
  /** ms until auto-hide; `null` keeps until dismissed */
  duration?: number | null;
  /** When false, always show even if user dismissed this id earlier in the session */
  respectDismiss?: boolean;
  /** Re-translate message on applyLanguage when set */
  messageKey?: string;
}

const DISMISS_PREFIX = "toast-dismissed:";

const DEFAULT_DURATION: Record<ToastType, number | null> = {
  warning: null,
  error: 8000,
  success: 4500,
  info: 5000,
};

const active = new Map<string, HTMLElement>();

function getHost(): HTMLElement {
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  return host;
}

function iconFor(type: ToastType): string {
  if (type === "warning") return "warning";
  if (type === "error") return "error";
  if (type === "success") return "check_circle";
  return "info";
}

function isDismissed(id: string): boolean {
  try {
    return sessionStorage.getItem(DISMISS_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

function markDismissed(id: string): void {
  try {
    sessionStorage.setItem(DISMISS_PREFIX + id, "1");
  } catch {
    /* storage unavailable */
  }
}

function removeToastEl(el: HTMLElement, id: string): void {
  el.classList.remove("toast-enter");
  el.classList.add("toast-exit");
  const done = () => {
    el.remove();
    active.delete(id);
  };
  el.addEventListener("transitionend", done, { once: true });
  setTimeout(done, 400);
}

function mountToast(id: string, opts: ShowToastOptions): HTMLElement {
  const type = opts.type ?? "info";
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.dataset.toastId = id;
  if (opts.messageKey) el.dataset.i18nToast = opts.messageKey;

  const icon = document.createElement("span");
  icon.className = "material-symbols-outlined toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = iconFor(type);

  const msg = document.createElement("p");
  msg.className = "toast-message";
  msg.textContent = opts.message;

  const actions = document.createElement("div");
  actions.className = "toast-actions";

  if (opts.action) {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "toast-action";
    actionBtn.textContent = opts.action.label;
    if (opts.action.labelKey) actionBtn.dataset.i18nToastAction = opts.action.labelKey;
    actionBtn.onclick = () => opts.action!.onClick();
    actions.appendChild(actionBtn);
  }

  const dismissBtn = document.createElement("button");
  dismissBtn.type = "button";
  dismissBtn.className = "toast-dismiss";
  dismissBtn.setAttribute("aria-label", t("toast-dismiss"));
  dismissBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
  dismissBtn.onclick = () => {
    if (opts.id) markDismissed(id);
    dismissToast(id);
  };

  el.append(icon, msg, actions, dismissBtn);
  getHost().appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-enter"));
  active.set(id, el);

  const duration = opts.duration !== undefined ? opts.duration : DEFAULT_DURATION[type];
  if (duration != null) {
    window.setTimeout(() => dismissToast(id), duration);
  }

  return el;
}

function updateToast(id: string, opts: ShowToastOptions): void {
  const el = active.get(id);
  if (!el) {
    mountToast(id, opts);
    return;
  }
  if (opts.messageKey) el.dataset.i18nToast = opts.messageKey;
  else delete el.dataset.i18nToast;
  const msg = el.querySelector(".toast-message");
  if (msg) msg.textContent = opts.message;

  const actions = el.querySelector(".toast-actions");
  if (actions) {
    actions.innerHTML = "";
    if (opts.action) {
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "toast-action";
      actionBtn.textContent = opts.action.label;
      if (opts.action.labelKey) actionBtn.dataset.i18nToastAction = opts.action.labelKey;
      actionBtn.onclick = () => opts.action!.onClick();
      actions.appendChild(actionBtn);
    }
  }
}

/** Show or update a toast. Returns the toast id. */
export function showToast(opts: ShowToastOptions): string {
  const id = opts.id ?? `toast-${Date.now()}`;
  if (opts.respectDismiss !== false && isDismissed(id)) return id;

  if (active.has(id)) {
    updateToast(id, opts);
    return id;
  }

  mountToast(id, opts);
  return id;
}

/** Hide a toast by id. Clears session dismiss flag so it can show again. */
export function dismissToast(id: string): void {
  const el = active.get(id);
  if (!el) return;
  removeToastEl(el, id);
}

/** Re-apply i18n strings on visible toasts (call after applyLanguage). */
export function refreshToasts(): void {
  document.querySelectorAll<HTMLElement>("[data-i18n-toast]").forEach((el) => {
    const key = el.dataset.i18nToast;
    if (!key) return;
    const msg = el.querySelector(".toast-message");
    if (msg) msg.textContent = t(key);
  });
  document.querySelectorAll<HTMLButtonElement>("[data-i18n-toast-action]").forEach((btn) => {
    const key = btn.dataset.i18nToastAction;
    if (key) btn.textContent = t(key);
  });
  document.querySelectorAll<HTMLButtonElement>(".toast-dismiss").forEach((btn) => {
    btn.setAttribute("aria-label", t("toast-dismiss"));
  });
}
