import "./style.css";

// Browser preview has no native traffic-light inset — adjust titlebar spacing.
if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
  document.documentElement.classList.add("web-preview");
}

import { store } from "./store";
import { PROVIDERS, providerMeta, isConfigured, DEFAULT_EXTRACTION_PROMPT } from "./llm";
import type { ProviderId } from "./config";
import { applyLanguage, t, getLang, type Lang } from "./i18n";
import { refreshToasts } from "./toast";
import { initBrainDump, refreshBrainDumpChrome, refreshBrainDumpConfig, refreshDraft } from "./views/braindump";
import { initSort, renderSort, requestFinishSort } from "./views/sort";
import { initTodo, refreshTodoI18n, focusHighlightedTask, moveTaskFocus, toggleFocusedTaskDone, editFocusedTask, isQuadrantPickerOpen, openFocusedQuadrantPicker, closeQuadrantPickerMenu, moveQuadrantPickerFocus, selectFocusedQuadrantOption, requestDeleteFocusedTask } from "./views/todo";
import { initConfirmDialog, isConfirmDialogOpen, closeConfirmDialog, confirmDialogAction } from "./confirm-dialog";
import { initPomodoro, focusOnTask, refreshPomodoroI18n, openTaskPopover, toggleTimer, skipToNextSession, fullResetTimer, handleTrayCmd, completeActiveTask } from "./views/pomodoro";
import { initTrayBridge } from "./tray";
import { initQuickAddBridge } from "./quick-add-bridge";
import { type ThemePref, getThemePref, setThemePref, applyEffectiveTheme, initThemeSync } from "./theme";
import {
  initSettingsPermissions,
  refreshPermissionsPanel,
  registerSettingsNavigation,
} from "./settings-permissions";

// Injected by Vite from package.json — used as the About-tab version fallback in browser preview.
declare const __APP_VERSION__: string;

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type View = "braindump" | "sort" | "todo" | "pomodoro";

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const SIDEBAR_COLLAPSED_KEY = "sb:sidebar-collapsed";

// Restore collapse state before first paint to avoid a flash.
// Default to collapsed on first visit for an isolated writing canvas.
try {
  const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  if (stored !== "0") {
    document.body.classList.add("sidebar-collapsed");
  }
} catch {
  document.body.classList.add("sidebar-collapsed");
}

function toggleSidebar() {
  const collapsed = document.body.classList.toggle("sidebar-collapsed");
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* storage unavailable — state simply won't persist */
  }
}

function wireSidebarToggle() {
  $("sidebarToggle").onclick = toggleSidebar;
  $("sidebarToggleFloating").onclick = toggleSidebar;
}

// ─── View Transitions ─────────────────────────────────────────────────────────

const VIEWS: View[] = ["braindump", "sort", "todo", "pomodoro"];

let currentView: View = "braindump";

// Cycle to an adjacent view (wraps at both ends).
function navigateRelative(delta: number) {
  const i = VIEWS.indexOf(currentView);
  const next = (i + delta + VIEWS.length) % VIEWS.length;
  switchView(VIEWS[next]);
}

function switchView(view: View) {
  if (view === currentView) return;

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", (tab as HTMLElement).dataset.view === view);
  });

  const outgoing = $(`view-${currentView}`);
  const incoming = $(`view-${view}`);

  outgoing.classList.add("exiting");
  outgoing.classList.remove("active");
  incoming.classList.remove("exiting");
  incoming.classList.add("active");

  setTimeout(() => {
    outgoing.classList.remove("exiting");
  }, 420);

  currentView = view;

  // The Sort page's bottom action bar would otherwise sit under the help FAB.
  document.body.classList.toggle("on-sort-view", view === "sort");

  if (view === "braindump") collapseSidebar();

  // Re-render the entered view so it reflects the latest session state.
  if (view === "sort") renderSort();
  if (view === "todo") refreshTodoI18n();
}

function collapseSidebar() {
  try {
    if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "0") return;
  } catch {
    /* storage unavailable — still collapse for zen dump */
  }
  document.body.classList.add("sidebar-collapsed");
}

// ─── Theme ──────────────────────────────────────────────────────────────────────
// Theme lives in Settings → Appearance and applies live (persisted to localStorage).
// "System" follows the OS appearance; resolution + cross-window sync live in theme.ts.

function syncThemeButtons(pref: ThemePref) {
  document.querySelectorAll<HTMLElement>("#themeControl .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.theme === pref);
  });
}

function currentTheme(): ThemePref {
  return getThemePref();
}

function applyTheme(pref: ThemePref) {
  setThemePref(pref);
  applyEffectiveTheme(pref);
  syncThemeButtons(pref);
}

function initTheme() {
  applyTheme(getThemePref());
  document.querySelectorAll<HTMLElement>("#themeControl .seg-btn").forEach((b) => {
    b.onclick = () => applyTheme(b.dataset.theme as ThemePref);
  });
  // Follow OS appearance changes live while in system mode.
  initThemeSync(() => syncThemeButtons(getThemePref()));
}

// ─── First-launch hint (replaces carousel onboarding) ───────────────────────

const ONBOARDING_DONE_KEY = "sb-onboarding-done";

function dismissWelcomeHint() {
  $("bdWelcome").classList.add("hidden");
  try {
    localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

function initOnboarding() {
  $("bdWelcomeDismiss").onclick = dismissWelcomeHint;
  try {
    if (!localStorage.getItem(ONBOARDING_DONE_KEY)) {
      $("bdWelcome").classList.remove("hidden");
    }
  } catch {
    $("bdWelcome").classList.remove("hidden");
  }
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function refreshSettingsBtn() {
  $("settingsBtn").classList.toggle("configured", isConfigured(store.settings));
}

function populateProviderSelect() {
  const sel = $<HTMLSelectElement>("providerSelect");
  sel.innerHTML = "";
  for (const p of PROVIDERS) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label;
    sel.appendChild(opt);
  }
}

function showProviderFields(id: ProviderId) {
  const meta = providerMeta(id);
  const cfg = store.settings.providers[id];
  $<HTMLInputElement>("modelInput").value = cfg.model || meta.defaultModel;
  $("modelHint").textContent = meta.modelHint;

  $("apiKeyField").style.display = meta.needsKey ? "block" : "none";
  $<HTMLInputElement>("apiKeyInput").value = cfg.apiKey || "";
  $("apiKeyHint").textContent = meta.keyHint;

  $("baseUrlField").style.display = id === "ollama" ? "block" : "none";
  $<HTMLInputElement>("baseUrlInput").value = cfg.baseUrl || "";
}

function openSettings(initialTab?: string) {
  const sel = $<HTMLSelectElement>("providerSelect");
  sel.value = store.settings.provider;
  showProviderFields(store.settings.provider);
  $<HTMLSelectElement>("languageSelect").value = store.settings.language ?? "en";
  $<HTMLSelectElement>("completedOrderSelect").value =
    store.settings.completedToBottom === false ? "keep" : "bottom";
  applyTheme(currentTheme()); // refresh seg-button active state
  $<HTMLTextAreaElement>("promptTextarea").value =
    store.settings.extractionPrompt?.trim() || DEFAULT_EXTRACTION_PROMPT;

  const tabs = settingsTabs();
  let tabIndex = 0;
  if (initialTab) {
    const found = tabs.findIndex((t) => t.dataset.tab === initialTab);
    if (found >= 0) tabIndex = found;
  }
  activateSettingsTab(tabIndex);

  void refreshAboutPanel();
  void refreshPermissionsPanel();
  $("modalBackdrop").classList.remove("hidden");
}

function closeSettings() {
  $("modalBackdrop").classList.add("hidden");
}

function saveSettingsFromModal() {
  const id = $<HTMLSelectElement>("providerSelect").value as ProviderId;
  const cfg = store.settings.providers[id];
  cfg.model = $<HTMLInputElement>("modelInput").value.trim() || providerMeta(id).defaultModel;
  cfg.apiKey = $<HTMLInputElement>("apiKeyInput").value.trim();
  if (id === "ollama") cfg.baseUrl = $<HTMLInputElement>("baseUrlInput").value.trim() || "http://localhost:11434";
  store.settings.provider = id;
  store.settings.language = $<HTMLSelectElement>("languageSelect").value as Lang;
  store.settings.completedToBottom = $<HTMLSelectElement>("completedOrderSelect").value !== "keep";

  // Store the custom prompt only when it differs from the default.
  const prompt = $<HTMLTextAreaElement>("promptTextarea").value.trim();
  store.settings.extractionPrompt = prompt && prompt !== DEFAULT_EXTRACTION_PROMPT.trim() ? prompt : "";

  store.persistSettings().catch((e) => console.error("Failed to save settings:", e));

  applyLanguage(store.settings.language);
  refreshPomodoroI18n();
  refreshTodoI18n();
  refreshBrainDumpChrome();
  refreshToasts();
  renderSort();

  closeSettings();
  refreshSettingsBtn();
  refreshBrainDumpConfig();
}

// ─── Settings tabs ────────────────────────────────────────────────────────────

function settingsTabs(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>("#settingsTabs .modal-tab")];
}

function activeSettingsTabIndex(): number {
  const i = settingsTabs().findIndex((t) => t.classList.contains("active"));
  return i < 0 ? 0 : i;
}

function activateSettingsTab(index: number) {
  const tabs = settingsTabs();
  if (!tabs.length) return;
  const clamped = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, i) => {
    const on = i === clamped;
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-selected", on ? "true" : "false");
    const panel = $(`settingsPanel-${tab.dataset.tab}`);
    if (panel) panel.hidden = !on;
  });
  tabs[clamped].scrollIntoView({ block: "nearest", inline: "nearest" });
}

// Cycle to the next (+1) or previous (-1) tab, wrapping around. Used by the keyboard shortcut.
function cycleSettingsTab(dir: 1 | -1) {
  activateSettingsTab(activeSettingsTabIndex() + dir);
}

function wireSettingsTabs() {
  settingsTabs().forEach((tab, i) => {
    tab.addEventListener("click", () => activateSettingsTab(i));
  });
}

// Populate the About panel. Runs each time settings opens so version reflects the live build.
async function refreshAboutPanel() {
  $("aboutPlatform").textContent = detectPlatform();

  let version = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "—";
  const tauriRow = $("aboutTauriRow");
  if (isTauri()) {
    try {
      const { getVersion, getTauriVersion } = await import("@tauri-apps/api/app");
      version = await getVersion();
      $("aboutTauri").textContent = await getTauriVersion();
      tauriRow.hidden = false;
    } catch (e) {
      console.error("Failed to read app/Tauri version:", e);
      tauriRow.hidden = true;
    }
  } else {
    tauriRow.hidden = true;
  }
  $("aboutVersion").textContent = version;
}

function detectPlatform(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Mac|iP(hone|ad|od)/.test(ua)) return "macOS";
  if (/Win/.test(ua)) return "Windows";
  if (/Linux|X11/.test(ua)) return "Linux";
  return "Unknown";
}

function wireSettingsModal() {
  populateProviderSelect();
  wireSettingsTabs();
  registerSettingsNavigation((tab) => openSettings(tab));
  initSettingsPermissions();
  $("settingsBtn").onclick = () => openSettings();
  $("modalCloseBtn").onclick = closeSettings;
  $("modalCancelBtn").onclick = closeSettings;
  $("modalSaveBtn").onclick = saveSettingsFromModal;
  $("promptResetBtn").onclick = () => {
    $<HTMLTextAreaElement>("promptTextarea").value = DEFAULT_EXTRACTION_PROMPT;
  };
  $<HTMLSelectElement>("providerSelect").onchange = (e) => {
    showProviderFields((e.target as HTMLSelectElement).value as ProviderId);
  };
  $("modalBackdrop").addEventListener("click", function (e) {
    if (e.target === this && isConfigured(store.settings)) closeSettings();
  });
}

// ─── History Dialog ─────────────────────────────────────────────────────────────

function loadSession(id: string) {
  store.data.activeSessionId = id;
  store.data.draftDump = store.activeSession()?.dump ?? "";
  store.persistData();
  refreshDraft();
  renderSort();
  refreshTodoI18n();
  $("historyBackdrop").classList.add("hidden");
  switchView("sort");
}

function openHistory() {
  const list = $("historyList");
  const sessions = [...store.data.sessions].sort((a, b) => b.createdAt - a.createdAt);
  list.innerHTML = "";

  if (!sessions.length) {
    list.innerHTML = `<div class="history-empty">${t("history-empty")}</div>`;
  } else {
    const locale = getLang() === "ar" ? "ar-EG" : undefined;
    for (const s of sessions) {
      const row = document.createElement("button");
      row.className = "history-row";
      if (s.id === store.data.activeSessionId) row.classList.add("active");

      const head = document.createElement("div");
      head.className = "history-row-head";
      const title = document.createElement("span");
      title.className = "history-row-title";
      title.textContent = s.title || "Untitled";
      const date = document.createElement("span");
      date.className = "history-row-date";
      date.textContent = new Date(s.createdAt).toLocaleDateString(locale, {
        month: "short", day: "numeric", year: "numeric",
      });
      head.append(title, date);

      const preview = document.createElement("div");
      preview.className = "history-row-preview";
      preview.textContent = (s.dump || s.summary || "").replace(/\s+/g, " ").trim().slice(0, 100);

      const meta = document.createElement("div");
      meta.className = "history-row-meta";
      meta.textContent = t("history-tasks", { count: s.tasks.length });

      row.append(head, preview, meta);
      row.onclick = () => loadSession(s.id);
      list.appendChild(row);
    }
  }
  $("historyBackdrop").classList.remove("hidden");
}

function wireHistory() {
  $("historyCloseBtn").onclick = () => $("historyBackdrop").classList.add("hidden");
  $("historyBackdrop").addEventListener("click", function (e) {
    if (e.target === this) this.classList.add("hidden");
  });
}

// ─── Export Dialog ──────────────────────────────────────────────────────────────

function openExportDialog(md: string) {
  $<HTMLTextAreaElement>("exportMd").value = md;
  $("exportBackdrop").classList.remove("hidden");
}

function wireExport() {
  const close = () => $("exportBackdrop").classList.add("hidden");
  $("exportCloseBtn").onclick = close;
  $("exportBackdrop").addEventListener("click", function (e) {
    if (e.target === this) close();
  });
  $("exportCopyBtn").onclick = () => {
    navigator.clipboard.writeText($<HTMLTextAreaElement>("exportMd").value).then(() => {
      const btn = $("exportCopyBtn");
      const label = btn.querySelector("span:last-child")!;
      const original = label.textContent;
      label.textContent = t("btn-copied");
      btn.classList.add("copied");
      setTimeout(() => {
        label.textContent = original;
        btn.classList.remove("copied");
      }, 2000);
    });
  };
}

// ─── Help / keyboard shortcuts ────────────────────────────────────────────────

// `mod` renders as ⌘ on macOS, Ctrl elsewhere. Keep in sync with wireGlobalShortcuts.
const IS_MAC = typeof navigator !== "undefined" && /Mac|iP(hone|ad|od)/.test(navigator.platform);
const MOD = IS_MAC ? "⌘" : "Ctrl";

const HELP_GROUPS: {
  titleKey: string;
  rows: { keys: string[]; descKey: string; sep?: string }[];
}[] = [
  {
    titleKey: "kb-group-general",
    rows: [
      ...(IS_MAC ? [{ keys: ["Ctrl", "Ctrl"], descKey: "kb-quick-add" }] : []),
      { keys: [MOD, ","], descKey: "kb-settings" },
      { keys: [MOD, "B"], descKey: "kb-sidebar" },
      { keys: [MOD, "P"], descKey: "kb-history" },
      { keys: [MOD, "⇧", "["], descKey: "kb-prev-page" },
      { keys: [MOD, "⇧", "]"], descKey: "kb-next-page" },
      { keys: [MOD, "/"], descKey: "kb-help" },
      { keys: ["Esc"], descKey: "kb-close" },
    ],
  },
  {
    titleKey: "kb-group-tasks",
    rows: [
      { keys: ["↑", "↓"], descKey: "kb-cycle-tasks", sep: "/" },
      { keys: ["↵"], descKey: "kb-edit-task" },
      { keys: ["Space"], descKey: "kb-change-quadrant" },
      { keys: [MOD, "⌫"], descKey: "kb-delete-task" },
      { keys: [MOD, "L"], descKey: "kb-toggle-done" },
      { keys: [MOD, "↵"], descKey: "kb-focus-highlighted" },
      { keys: [MOD, "↵"], descKey: "kb-finish-sort" },
    ],
  },
  {
    titleKey: "kb-group-focus",
    rows: [
      { keys: ["Space"], descKey: "kb-pomo-toggle" },
      { keys: [MOD, "⇧", "→"], descKey: "kb-pomo-skip" },
      { keys: [MOD, "⇧", "R"], descKey: "kb-pomo-full-reset" },
      { keys: [MOD, "↓"], descKey: "kb-open-task-picker" },
      { keys: ["↑", "↓"], descKey: "kb-nav-picker", sep: "/" },
      { keys: ["↵"], descKey: "kb-select-task" },
      { keys: [MOD, "↵"], descKey: "kb-complete-focus-task" },
    ],
  },
];

function renderHelpGrid() {
  const grid = $("helpGrid");
  grid.innerHTML = "";
  for (const group of HELP_GROUPS) {
    const wrap = document.createElement("div");
    wrap.className = "kb-group";
    const title = document.createElement("div");
    title.className = "kb-group-title";
    title.textContent = t(group.titleKey);
    wrap.appendChild(title);
    for (const row of group.rows) {
      const r = document.createElement("div");
      r.className = "kb-row";
      const desc = document.createElement("span");
      desc.className = "kb-desc";
      desc.textContent = t(row.descKey);
      const keys = document.createElement("span");
      keys.className = "kb-keys";
      row.keys.forEach((k, i) => {
        if (i) {
          const sep = document.createElement("span");
          sep.className = "kb-sep";
          sep.textContent = row.sep ?? "+";
          keys.appendChild(sep);
        }
        const kbd = document.createElement("kbd");
        kbd.textContent = k;
        keys.appendChild(kbd);
      });
      r.append(desc, keys);
      wrap.appendChild(r);
    }
    grid.appendChild(wrap);
  }
}

function openHelp() {
  renderHelpGrid();
  $("helpBackdrop").classList.remove("hidden");
}

function closeHelp() {
  $("helpBackdrop").classList.add("hidden");
}

function toggleHelp() {
  if ($("helpBackdrop").classList.contains("hidden")) openHelp();
  else closeHelp();
}

function wireHelp() {
  $("helpBtn").onclick = openHelp;
  $("helpCloseBtn").onclick = closeHelp;
  $("helpBackdrop").addEventListener("click", function (e) {
    if (e.target === this) closeHelp();
  });
}

// ─── Global keyboard shortcuts ──────────────────────────────────────────────────

function anyModalOpen(): boolean {
  return [...document.querySelectorAll(".modal-backdrop")].some(
    (m) => !m.classList.contains("hidden"),
  );
}

// True when the user is typing into a field — used so arrow keys don't hijack input.
function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === "INPUT" ||
    node.tagName === "TEXTAREA" ||
    node.tagName === "SELECT" ||
    node.isContentEditable
  );
}

// Close the topmost open modal. Esc dismisses settings unconditionally, matching
// the Discard button (the backdrop-click config guard doesn't apply here).
function closeTopModal() {
  const open = [...document.querySelectorAll<HTMLElement>(".modal-backdrop")].filter(
    (m) => !m.classList.contains("hidden"),
  );
  open[open.length - 1]?.classList.add("hidden");
}

function wireGlobalShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Esc → dismiss confirm dialog, quadrant picker, or the open panel
    if (e.key === "Escape") {
      if (isConfirmDialogOpen()) {
        e.preventDefault();
        closeConfirmDialog();
        return;
      }
      if (isQuadrantPickerOpen()) {
        e.preventDefault();
        closeQuadrantPickerMenu();
        return;
      }
      if (anyModalOpen()) {
        e.preventDefault();
        closeTopModal();
        return;
      }
    }

    // Enter → confirm delete dialog action
    if (
      e.key === "Enter" &&
      !e.metaKey && !e.ctrlKey && !e.altKey &&
      isConfirmDialogOpen()
    ) {
      e.preventDefault();
      confirmDialogAction();
      return;
    }

    // Space → open quadrant picker on Tasks page, or start/pause Pomodoro on Focus page
    if (
      e.key === " " &&
      !anyModalOpen() &&
      !isTypingTarget(e.target)
    ) {
      if (currentView === "todo") {
        e.preventDefault();
        if (isQuadrantPickerOpen()) closeQuadrantPickerMenu();
        else openFocusedQuadrantPicker();
        return;
      }
      if (currentView === "pomodoro") {
        e.preventDefault();
        toggleTimer();
        return;
      }
    }

    // ↑ / ↓ → navigate quadrant picker or cycle task focus on the Tasks page
    if (
      (e.key === "ArrowUp" || e.key === "ArrowDown") &&
      !e.metaKey && !e.ctrlKey && !e.altKey
    ) {
      if (isQuadrantPickerOpen()) {
        e.preventDefault();
        moveQuadrantPickerFocus(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (currentView !== "todo" || anyModalOpen() || isTypingTarget(e.target)) return;
      e.preventDefault();
      moveTaskFocus(e.key === "ArrowDown" ? 1 : -1);
      return;
    }

    // Enter → select quadrant, edit highlighted task, or other context actions
    if (
      e.key === "Enter" &&
      !e.metaKey && !e.ctrlKey && !e.altKey
    ) {
      if (isQuadrantPickerOpen()) {
        e.preventDefault();
        selectFocusedQuadrantOption();
        return;
      }
      if (currentView !== "todo" || anyModalOpen() || isTypingTarget(e.target)) return;
      e.preventDefault();
      editFocusedTask();
      return;
    }

    if (!(e.metaKey || e.ctrlKey)) return;

    // Cmd/Ctrl+/  → toggle keyboard-shortcuts panel
    if (e.key === "/") {
      e.preventDefault();
      toggleHelp();
      return;
    }
    // Cmd/Ctrl+L  → toggle the focused task complete (Tasks page)
    if (e.key.toLowerCase() === "l") {
      if (currentView !== "todo" || anyModalOpen() || isConfirmDialogOpen() || isQuadrantPickerOpen()) return;
      e.preventDefault();
      toggleFocusedTaskDone();
      return;
    }
    // Cmd/Ctrl+Delete/Backspace → delete the focused task (Tasks page)
    if (e.key === "Delete" || e.key === "Backspace") {
      if (currentView !== "todo" || anyModalOpen() || isConfirmDialogOpen() || isQuadrantPickerOpen() || isTypingTarget(e.target)) return;
      e.preventDefault();
      requestDeleteFocusedTask();
      return;
    }
    // Cmd/Ctrl+↓  → open the task-picker popover (Focus page)
    if (e.key === "ArrowDown") {
      if (currentView !== "pomodoro" || anyModalOpen()) return;
      e.preventDefault();
      openTaskPopover();
      return;
    }
    // Cmd/Ctrl+Shift+→  → skip to next Pomodoro session (Focus page)
    if (e.shiftKey && e.code === "ArrowRight") {
      if (currentView !== "pomodoro" || anyModalOpen()) return;
      e.preventDefault();
      skipToNextSession();
      return;
    }
    // Cmd/Ctrl+Shift+R  → full Pomodoro reset (Focus page)
    if (e.shiftKey && e.key.toLowerCase() === "r") {
      if (currentView !== "pomodoro" || anyModalOpen()) return;
      e.preventDefault();
      fullResetTimer();
      return;
    }
    // Cmd/Ctrl+P  → open the dump history
    if (e.key.toLowerCase() === "p") {
      if (anyModalOpen()) return;
      e.preventDefault();
      openHistory();
      return;
    }
    // Cmd/Ctrl+,  → settings
    if (e.key === ",") {
      e.preventDefault();
      openSettings();
      return;
    }
    // Cmd/Ctrl+B  → toggle sidebar
    if (e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
      return;
    }
    // Cmd/Ctrl+Shift+[ / ]  → settings tabs when open, else page navigation
    if (e.shiftKey && (e.code === "BracketLeft" || e.code === "BracketRight")) {
      const settingsOpen = !$("modalBackdrop").classList.contains("hidden");
      if (settingsOpen) {
        e.preventDefault();
        cycleSettingsTab(e.code === "BracketRight" ? 1 : -1);
        return;
      }
      if (anyModalOpen()) return;
      e.preventDefault();
      navigateRelative(e.code === "BracketRight" ? 1 : -1);
      return;
    }
    // Cmd/Ctrl+Enter  → context action (Brain Dump handled in its textarea)
    if (e.key === "Enter") {
      if (anyModalOpen()) return;
      if (currentView === "sort") {
        e.preventDefault();
        requestFinishSort();
      } else if (currentView === "todo") {
        e.preventDefault();
        focusHighlightedTask();
      } else if (currentView === "pomodoro") {
        e.preventDefault();
        if (completeActiveTask()) switchView("todo");
      }
    }
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main() {
  await store.init();

  applyLanguage((store.settings.language ?? "en") as Lang);

  initTheme();
  initOnboarding();
  wireSettingsModal();
  wireHistory();
  wireExport();
  wireHelp();
  wireSidebarToggle();
  initConfirmDialog();
  wireGlobalShortcuts();

  document.querySelectorAll(".tab").forEach((tab) => {
    (tab as HTMLElement).onclick = () => switchView((tab as HTMLElement).dataset.view as View);
  });

  initBrainDump({
    openSettings,
    onExtracted: () => switchView("sort"),
    openHistory,
    dismissWelcomeHint,
  });
  initSort({
    openExportDialog,
    switchToTodo: () => switchView("todo"),
    switchToDump: () => switchView("braindump"),
  });
  initTodo({
    onFocusTask: (text) => {
      focusOnTask(text);
      switchView("pomodoro");
    },
  });
  initPomodoro();
  void initTrayBridge(handleTrayCmd);
  void initQuickAddBridge();

  refreshSettingsBtn();
  refreshBrainDumpConfig();
}

main().catch((e) => {
  console.error("Failed to start SilverBrain:", e);
  document.body.innerHTML = `<pre style="padding:24px;color:#e5e1e6;background:#010102">Failed to start: ${e?.message || e}</pre>`;
});
