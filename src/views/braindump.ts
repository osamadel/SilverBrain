// Brain Dump page: a minimal free-text canvas. Cmd/Ctrl+Enter (or the Extract
// button) runs LLM extraction, snapshots the result into a new session, and
// hands off to the Sort page. The textarea edits a scratch draft (store.data
// .draftDump) so typing survives reloads without polluting session history.
import { store } from "../store";
import { extractTasksWithQuadrants, generateSessionMeta, isConfigured } from "../llm";
import { loadMemory } from "../config";
import { uid } from "../config";
import { t } from "../i18n";
import { dismissToast, showToast } from "../toast";

let openSettings: () => void = () => {};
let onExtracted: () => void = () => {};
let openHistory: () => void = () => {};

let dismissWelcomeHint: () => void = () => {};

const TOAST_NO_PROVIDER = "no-provider";

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const ZEN_FADE_MS = 3000;

let zenTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleZenFade() {
  const bdPage = document.querySelector(".bd-page");
  if (!bdPage) return;

  if (zenTimer) clearTimeout(zenTimer);
  bdPage.classList.remove("bd-zen");

  const ta = $<HTMLTextAreaElement>("dumpInput");
  if (!ta.value.trim()) return;

  zenTimer = setTimeout(() => {
    if (document.activeElement === ta && ta.value.trim()) {
      bdPage.classList.add("bd-zen");
    }
  }, ZEN_FADE_MS);
}

function clearZenFade() {
  if (zenTimer) clearTimeout(zenTimer);
  document.querySelector(".bd-page")?.classList.remove("bd-zen");
}

function isMacPlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
}

function syncExtractKbdChip(): void {
  const mod = $<HTMLElement>("extractKbdMod");
  if (mod) mod.textContent = isMacPlatform() ? "⌘" : "Ctrl";
}

function syncExtractBtnVisibility(): void {
  const ta = $<HTMLTextAreaElement>("dumpInput");
  const btn = $<HTMLButtonElement>("extractBtn");
  const hasText = ta.value.trim().length > 0;
  btn.classList.toggle("is-visible", hasText);
  btn.setAttribute("aria-hidden", hasText ? "false" : "true");
  btn.tabIndex = hasText ? 0 : -1;
}

function showNoProviderToast(force = false): void {
  showToast({
    id: TOAST_NO_PROVIDER,
    type: "warning",
    message: t("no-provider"),
    messageKey: "no-provider",
    action: {
      label: t("open-settings-btn"),
      labelKey: "open-settings-btn",
      onClick: () => openSettings(),
    },
    respectDismiss: !force,
  });
}

/** Sync chrome that depends on locale or platform (call after applyLanguage). */
export function refreshBrainDumpChrome(): void {
  syncExtractKbdChip();
  const historyBtn = $<HTMLButtonElement>("historyBtn");
  const key = historyBtn.dataset.i18nTitle;
  if (key) historyBtn.title = t(key);
  syncExtractBtnVisibility();
}

/** Local fallback when the model can't produce a title/summary. */
function heuristicMeta(dump: string): { title: string; summary: string } {
  const firstLine = dump.split("\n").map((l) => l.trim()).find(Boolean) ?? "Brain dump";
  return {
    title: firstLine.split(/\s+/).slice(0, 6).join(" ").slice(0, 60) || "Brain dump",
    summary: dump.replace(/\s+/g, " ").trim().slice(0, 140),
  };
}

async function runExtract() {
  if (!isConfigured(store.settings)) {
    showNoProviderToast(true);
    return;
  }
  const input = $<HTMLTextAreaElement>("dumpInput").value.trim();
  if (!input) {
    showToast({
      type: "warning",
      message: t("status-write-first"),
      messageKey: "status-write-first",
    });
    return;
  }

  const btn = $<HTMLButtonElement>("extractBtn");
  btn.disabled = true;

  try {
    const memory = await loadMemory().catch(() => "");
    const [tasks, meta] = await Promise.all([
      extractTasksWithQuadrants(store.settings, input, memory),
      generateSessionMeta(store.settings, input).catch(() => heuristicMeta(input)),
    ]);

    if (!tasks.length) {
      showToast({
        type: "warning",
        message: t("status-no-tasks"),
        messageKey: "status-no-tasks",
      });
      return;
    }

    // Reuse an empty scratch session if one is active; otherwise start a new one.
    const active = store.activeSession();
    const session = active && active.tasks.length === 0 ? active : store.createSession();
    session.dump = input;
    session.title = meta.title || heuristicMeta(input).title;
    session.summary = meta.summary || heuristicMeta(input).summary;
    session.createdAt = Date.now();
    session.tasks = tasks.map((task) => ({
      id: uid(),
      text: task.text,
      quadrant: task.quadrant,
      suggestedQuadrant: task.quadrant,
      done: false,
    }));
    store.data.activeSessionId = session.id;
    store.persistData();

    showToast({
      type: "success",
      message: tasks.length === 1
        ? t("task-extracted-one")
        : t("tasks-extracted", { count: tasks.length }),
    });
    onExtracted();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    showToast({
      type: "error",
      message: msg ? `${t("status-extract-error")} (${msg})` : t("status-extract-error"),
      ...(msg ? {} : { messageKey: "status-extract-error" }),
    });
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

export function initBrainDump(opts: {
  openSettings: () => void;
  onExtracted: () => void;
  openHistory: () => void;
  dismissWelcomeHint?: () => void;
}) {
  openSettings = opts.openSettings;
  onExtracted = opts.onExtracted;
  openHistory = opts.openHistory;
  dismissWelcomeHint = opts.dismissWelcomeHint ?? (() => {});

  const ta = $<HTMLTextAreaElement>("dumpInput");
  ta.value = store.data.draftDump;
  ta.addEventListener("input", () => {
    store.data.draftDump = ta.value;
    store.persistData();
    dismissWelcomeHint();
    syncExtractBtnVisibility();
    scheduleZenFade();
  });
  ta.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runExtract();
    }
  });
  ta.addEventListener("focus", scheduleZenFade);
  ta.addEventListener("blur", clearZenFade);

  $("extractBtn").onclick = runExtract;
  $("historyBtn").onclick = openHistory;

  refreshBrainDumpChrome();
}

/** Sync the textarea to the persisted draft (e.g. after restoring a session). */
export function refreshDraft() {
  $<HTMLTextAreaElement>("dumpInput").value = store.data.draftDump;
  syncExtractBtnVisibility();
}

/** Show or hide the no-provider toast when settings change. */
export function refreshBrainDumpConfig() {
  if (isConfigured(store.settings)) {
    dismissToast(TOAST_NO_PROVIDER);
    return;
  }
  showNoProviderToast();
}
