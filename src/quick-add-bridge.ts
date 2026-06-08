// Main window listener — quick-add task sync and permissions settings navigation.
import { store } from "./store";
import { refreshTodo } from "./views/todo";
import { QUICK_ADD_TASK_EVENT } from "./quick-add";
import { openPermissionsSettings, refreshPermissionsPanel } from "./settings-permissions";

interface QuickAddStatus {
  trusted: boolean;
  hotkey_active: boolean;
  enabled: boolean;
}

function isMacTauri(): boolean {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return false;
  return /Mac|iP(hone|ad|od)/.test(navigator.platform);
}

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return import("@tauri-apps/api/core").then(({ invoke: inv }) => inv<T>(cmd, args));
}

async function navigateToPermissionsIfNeeded(): Promise<void> {
  const status = await invoke<QuickAddStatus>("get_quick_add_status");
  await refreshPermissionsPanel();
  const granted = status.trusted || status.hotkey_active;
  if (!granted) openPermissionsSettings();
}

export async function initQuickAddBridge(): Promise<void> {
  if (!isMacTauri()) return;

  const { listen } = await import("@tauri-apps/api/event");
  await listen(QUICK_ADD_TASK_EVENT, async () => {
    await store.reloadData();
    refreshTodo();
  });

  await listen("quick-add:permission-needed", () => {
    void navigateToPermissionsIfNeeded();
  });

  await navigateToPermissionsIfNeeded();

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().listen("tauri://focus", () => {
    void refreshPermissionsPanel();
  });

  // Retry hotkey registration when user returns from System Settings.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refreshPermissionsPanel();
    }
  });
}
