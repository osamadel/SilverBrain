// Settings → Permissions tab (macOS Tauri): Accessibility for double-Ctrl quick-add.
import { store } from "./store";
import { t } from "./i18n";

interface QuickAddStatus {
  trusted: boolean;
  hotkey_active: boolean;
  enabled: boolean;
}

function isMacTauri(): boolean {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return false;
  return /Mac|iP(hone|ad|od)/.test(navigator.platform);
}

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return import("@tauri-apps/api/core").then(({ invoke: inv }) => inv<T>(cmd, args));
}

let openSettingsTab: (tab: string) => void = () => {};

export function registerSettingsNavigation(opener: (tab: string) => void): void {
  openSettingsTab = opener;
}

export function openPermissionsSettings(): void {
  openSettingsTab("permissions");
}

function quickAddFeatureEnabled(): boolean {
  return store.settings.quickAddEnabled !== false;
}

function updatePermissionActions(status: QuickAddStatus): void {
  const enabled = status.enabled;
  const granted = status.trusted || status.hotkey_active;
  const allowBtn = $<HTMLButtonElement>("permAccessibilityAllowBtn");
  const chip = $<HTMLSpanElement>("permAccessibilityAllowedChip");

  const showChip = enabled && granted;
  const showAllow = enabled && !granted;

  // .btn-primary sets display:flex and overrides the [hidden] attribute — use .hidden class.
  chip.classList.toggle("hidden", !showChip);
  allowBtn.classList.toggle("hidden", !showAllow);
  chip.hidden = !showChip;
  allowBtn.hidden = !showAllow;
  chip.textContent = t("perm-allowed");
}

export async function refreshPermissionsPanel(): Promise<void> {
  if (!isMacTauri()) return;

  const toggle = $<HTMLInputElement>("permQuickAddToggle");
  const [status, appName] = await Promise.all([
    invoke<QuickAddStatus>("get_quick_add_status"),
    invoke<string>("accessibility_client_label"),
  ]);

  toggle.checked = quickAddFeatureEnabled();
  $("permAccessibilityDesc").textContent = t("perm-accessibility-desc", { appName });

  let current = { ...status, enabled: quickAddFeatureEnabled() };
  updatePermissionActions(current);

  if (current.enabled && !current.hotkey_active) {
    await invoke<boolean>("ensure_quick_add_hotkey").catch((e) =>
      console.warn("ensure_quick_add_hotkey failed:", e),
    );
    current = await invoke<QuickAddStatus>("get_quick_add_status");
    current = { ...current, enabled: quickAddFeatureEnabled() };
    updatePermissionActions(current);
  }
}

async function syncQuickAddEnabledToRust(enabled: boolean): Promise<void> {
  await invoke("set_quick_add_enabled", { enabled });
  if (enabled) {
    await invoke<boolean>("ensure_quick_add_hotkey").catch((e) =>
      console.warn("ensure_quick_add_hotkey failed:", e),
    );
  }
  const status = await invoke<QuickAddStatus>("get_quick_add_status");
  updatePermissionActions({ ...status, enabled });
}

export function initSettingsPermissions(): void {
  const tab = $<HTMLButtonElement>("settingsTab-permissions");
  const panel = $("settingsPanel-permissions");

  if (!isMacTauri()) {
    tab.hidden = true;
    panel.hidden = true;
    return;
  }

  tab.hidden = false;

  const toggle = $<HTMLInputElement>("permQuickAddToggle");
  toggle.checked = quickAddFeatureEnabled();
  void syncQuickAddEnabledToRust(toggle.checked);

  toggle.onchange = () => {
    store.settings.quickAddEnabled = toggle.checked;
    store.persistSettings().catch((e) => console.error("Failed to save settings:", e));
    void syncQuickAddEnabledToRust(toggle.checked);
  };

  $<HTMLButtonElement>("permAccessibilityAllowBtn").onclick = () => {
    void invoke<boolean>("request_accessibility_permission")
      .then(() => refreshPermissionsPanel())
      .catch((e) => console.warn("request_accessibility_permission failed:", e));
  };
}
