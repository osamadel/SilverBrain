// Pomodoro view: focus / short break / long break timer with configurable
// durations. Durations and completed-session count persist via store.data.
import { store } from "../store";
import { type Quadrant } from "../config";
import { t } from "../i18n";
import { ensureNotificationPermission, showSystemNotification } from "../notifications";
import {
  NOTIFICATION_SOUND_IDS,
  normalizeSoundId,
  playNotificationSound,
  type NotificationSoundId,
} from "../notification-sounds";
import {
  activateTray,
  hideMainWindow,
  showMainWindow,
  syncTrayState,
  type PomodoroCmd,
  type PomodoroMode,
  type PomodoroState,
} from "../tray";

const QUADRANT_BADGE_KEY: Record<Quadrant, string> = {
  q1: "todo-badge-q1",
  q2: "todo-badge-q2",
  q3: "todo-badge-q3",
  q4: "todo-badge-q4",
};

type Mode = PomodoroMode;

let mode: Mode = "focus";
let remaining = 0; // seconds
let running = false;
let ticker: number | null = null;
let endAt: number | null = null; // wall-clock ms when the timer hits zero
let activeTaskText = "";

// Keyboard cursor index within the open task popover (-1 = none).
let popoverCursor = -1;

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function durationFor(m: Mode): number {
  const p = store.data.pomodoro;
  return (m === "focus" ? p.focus : m === "short" ? p.short : p.long) * 60;
}

function format(sec: number): string {
  const mm = Math.floor(sec / 60).toString().padStart(2, "0");
  const ss = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

const MODE_I18N_KEYS: Record<Mode, string> = {
  focus: "pomo-mode-focus",
  short: "pomo-mode-short",
  long:  "pomo-mode-long",
};

function currentState(): PomodoroState {
  return {
    remaining,
    running,
    mode,
    taskText: activeTaskText,
    focusSessions: store.data.focusSessions,
  };
}

function broadcastState() {
  void syncTrayState(currentState());
}

function renderTime() {
  $("pomoTime").textContent = format(remaining);
  $("pomoStartBtn").textContent = running ? t("btn-pomo-pause") : t("btn-pomo-start");
  $("pomoCount").textContent = t("pomo-sessions", { count: store.data.focusSessions });
  const outer = document.getElementById("pomoTimerOuter");
  if (outer) outer.classList.toggle("running", running);
  broadcastState();
}

function setMode(m: Mode, opts?: { autoStart?: boolean }) {
  mode = m;
  stop();
  remaining = durationFor(m);
  document.querySelectorAll(".pomo-mode").forEach((b) => {
    b.classList.toggle("active", (b as HTMLElement).dataset.mode === m);
  });
  const label = document.getElementById("pomoModeLabel");
  if (label) {
    const key = MODE_I18N_KEYS[m];
    label.dataset.i18n = key;
    label.textContent = t(key);
  }
  renderTime();
  if (opts?.autoStart) start({ fromAutoStart: true });
}

function breakAfterFocus(): Mode {
  const useLong =
    (store.data.focusSessions + 1) % store.data.pomodoro.interval === 0;
  return useLong ? "long" : "short";
}

function shouldAutoStartBreak(next: Mode): boolean {
  if (next === "short") return store.data.pomodoro.autoStartShort;
  if (next === "long") return store.data.pomodoro.autoStartLong;
  return false;
}

function completeFocusSession() {
  store.data.focusSessions++;
  store.persistData();
  const useLong = store.data.focusSessions % store.data.pomodoro.interval === 0;
  const next: Mode = useLong ? "long" : "short";
  const body = t(next === "long" ? "notify-focus-long" : "notify-focus-short");
  notify(t("notify-title-focus-done"), body, "focus");
  setMode(next, { autoStart: shouldAutoStartBreak(next) });
}

function syncRemainingFromDeadline() {
  if (endAt === null) return;
  remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

function tick() {
  syncRemainingFromDeadline();
  if (remaining > 0) {
    renderTime();
    return;
  }
  stop();
  if (mode === "focus") {
    completeFocusSession();
  } else {
    const body = t("notify-break-done");
    notify(t("notify-title-break-over"), body, mode);
    setMode("focus");
  }
}

function notify(title: string, body: string, kind: Mode) {
  void showSystemNotification(title, body);
  const p = store.data.pomodoro;
  const soundId =
    kind === "focus"
      ? p.soundFocus
      : kind === "short"
        ? p.soundShortBreak
        : p.soundLongBreak;
  playNotificationSound(soundId);
}

async function onFocusStart() {
  await hideMainWindow();
}

function start(opts?: { fromAutoStart?: boolean }) {
  if (running) return;
  void ensureNotificationPermission();
  running = true;
  endAt = Date.now() + remaining * 1000;
  ticker = window.setInterval(tick, 250);
  renderTime();
  if (mode === "focus" && !opts?.fromAutoStart) {
    void onFocusStart();
  }
}

function stop() {
  syncRemainingFromDeadline();
  running = false;
  endAt = null;
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
  renderTime();
}

function toggle() {
  running ? stop() : start();
}

function reset() {
  stop();
  remaining = durationFor(mode);
  renderTime();
}

function skipSession() {
  stop();
  if (mode === "focus") {
    const next = breakAfterFocus();
    setMode(next, { autoStart: shouldAutoStartBreak(next) });
  } else {
    setMode("focus");
  }
}

function fullReset() {
  stop();
  store.data.focusSessions = 0;
  store.persistData();
  mode = "focus";
  remaining = durationFor("focus");
  document.querySelectorAll(".pomo-mode").forEach((b) => {
    b.classList.toggle("active", (b as HTMLElement).dataset.mode === "focus");
  });
  const label = document.getElementById("pomoModeLabel");
  if (label) {
    label.dataset.i18n = MODE_I18N_KEYS.focus;
    label.textContent = t(MODE_I18N_KEYS.focus);
  }
  renderTime();
  void showMainWindow();
}

export function toggleTimer(): void {
  toggle();
}

export function skipToNextSession(): void {
  skipSession();
}

export function fullResetTimer(): void {
  fullReset();
}

export function handleTrayCmd(cmd: PomodoroCmd): void {
  switch (cmd.action) {
    case "toggle":
      toggle();
      break;
    case "skip":
      skipSession();
      break;
    case "fullReset":
      fullReset();
      break;
    case "setMode":
      setMode(cmd.mode);
      break;
  }
}

function renderTaskLabel() {
  const el = $("pomoTask");
  el.textContent = activeTaskText
    ? `${t("pomo-focusing-on")}: ${activeTaskText}`
    : t("pomo-no-task");
  broadcastState();
}

function closeTaskPopover() {
  $("pomoTaskPopover").classList.add("hidden");
  $("pomoTaskWrap").classList.remove("open");
  $("pomoTaskBtn").setAttribute("aria-expanded", "false");
  popoverCursor = -1;
}

function popoverOptions(): HTMLButtonElement[] {
  return [...$("pomoTaskPopover").querySelectorAll<HTMLButtonElement>(".pomo-task-option")];
}

function moveCursor(delta: number) {
  const opts = popoverOptions();
  if (!opts.length) return;
  popoverCursor =
    popoverCursor === -1
      ? (delta > 0 ? 0 : opts.length - 1)
      : (popoverCursor + delta + opts.length) % opts.length;
  opts.forEach((o, i) => o.classList.toggle("active", i === popoverCursor));
  opts[popoverCursor].scrollIntoView({ block: "nearest" });
}

function isPopoverOpen(): boolean {
  return !$("pomoTaskPopover").classList.contains("hidden");
}

function renderTaskPopover() {
  const popover = $("pomoTaskPopover");
  const items = store.activeSession()?.tasks ?? [];
  popover.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "pomo-task-popover-empty";
    empty.textContent = t("pomo-task-picker-empty");
    popover.appendChild(empty);
    return;
  }

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "pomo-task-option" + (!activeTaskText ? " selected" : "");
  clearBtn.setAttribute("role", "option");
  clearBtn.setAttribute("aria-selected", String(!activeTaskText));
  clearBtn.textContent = t("pomo-no-task");
  clearBtn.onclick = () => selectTask("");
  popover.appendChild(clearBtn);

  for (const item of items) {
    const selected = item.text === activeTaskText;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pomo-task-option" + (selected ? " selected" : "") + (item.done ? " done" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(selected));

    const text = document.createElement("span");
    text.className = "pomo-task-option-text";
    text.textContent = item.text;
    btn.appendChild(text);

    if (item.quadrant) {
      const badge = document.createElement("span");
      badge.className = "todo-badge " + item.quadrant;
      badge.textContent = t(QUADRANT_BADGE_KEY[item.quadrant]);
      btn.appendChild(badge);
    }

    btn.onclick = () => selectTask(item.text);
    popover.appendChild(btn);
  }
}

function toggleTaskPopover(open?: boolean) {
  const popover = $("pomoTaskPopover");
  const shouldOpen = open ?? popover.classList.contains("hidden");
  if (shouldOpen) {
    renderTaskPopover();
    popover.classList.remove("hidden");
    $("pomoTaskWrap").classList.add("open");
    $("pomoTaskBtn").setAttribute("aria-expanded", "true");
    const opts = popoverOptions();
    const sel = opts.findIndex((o) => o.classList.contains("selected"));
    popoverCursor = sel === -1 ? -1 : sel;
    opts.forEach((o, i) => o.classList.toggle("active", i === popoverCursor));
  } else {
    closeTaskPopover();
  }
}

function selectTask(text: string) {
  activeTaskText = text;
  renderTaskLabel();
  closeTaskPopover();
}

export function openTaskPopover(): void {
  toggleTaskPopover(true);
}

export function setActiveTask(text: string) {
  activeTaskText = text;
  renderTaskLabel();
}

/** Mark the active focus task complete, stop the timer, and clear tray if needed. */
export function completeActiveTask(): boolean {
  if (!activeTaskText) return false;
  const session = store.activeSession();
  if (!session) return false;
  const item = session.tasks.find((t) => t.text === activeTaskText);
  if (!item) return false;

  item.done = true;
  store.persistData();
  activeTaskText = "";
  closeTaskPopover();
  stop();
  renderTaskLabel();
  void showMainWindow();
  return true;
}

/** Set the active task, switch to focus mode, and start the timer immediately. */
export function focusOnTask(text: string): void {
  activeTaskText = text;
  renderTaskLabel();
  setMode("focus");
  start();
}

export function refreshPomodoroI18n(): void {
  const label = document.getElementById("pomoModeLabel");
  if (label) {
    const key = MODE_I18N_KEYS[mode];
    label.dataset.i18n = key;
    label.textContent = t(key);
  }
  for (const id of NOTIFICATION_SOUND_IDS) {
    document.querySelectorAll<HTMLOptionElement>(`option[value="${id}"]`).forEach((opt) => {
      opt.textContent = t(`sound-${id}`);
    });
  }
  syncSoundPreview("previewSoundFocus", "setSoundFocus");
  syncSoundPreview("previewSoundShort", "setSoundShort");
  syncSoundPreview("previewSoundLong", "setSoundLong");
  renderTaskLabel();
  renderTime();
}

function populateSoundSelect(select: HTMLSelectElement) {
  if (select.options.length === NOTIFICATION_SOUND_IDS.length) return;
  select.innerHTML = "";
  for (const id of NOTIFICATION_SOUND_IDS) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.dataset.i18n = `sound-${id}`;
    opt.textContent = t(`sound-${id}`);
    select.appendChild(opt);
  }
}

function syncSoundSelect(
  selectId: string,
  value: NotificationSoundId,
  key: "soundFocus" | "soundShortBreak" | "soundLongBreak",
) {
  const select = $<HTMLSelectElement>(selectId);
  populateSoundSelect(select);
  select.value = normalizeSoundId(value);
  select.onchange = (e) => {
    store.data.pomodoro[key] = normalizeSoundId((e.target as HTMLSelectElement).value);
    store.persistData();
  };
}

function syncSoundPreview(buttonId: string, selectId: string) {
  const btn = $<HTMLButtonElement>(buttonId);
  btn.setAttribute("aria-label", t("sound-preview"));
  btn.onclick = () => playNotificationSound($<HTMLSelectElement>(selectId).value);
}

function syncSettingsInputs() {
  $<HTMLInputElement>("setFocus").value = String(store.data.pomodoro.focus);
  $<HTMLInputElement>("setShort").value = String(store.data.pomodoro.short);
  $<HTMLInputElement>("setLong").value = String(store.data.pomodoro.long);
  $<HTMLInputElement>("setInterval").value = String(store.data.pomodoro.interval);
  $<HTMLInputElement>("setAutoStartShort").checked = store.data.pomodoro.autoStartShort;
  $<HTMLInputElement>("setAutoStartLong").checked = store.data.pomodoro.autoStartLong;
  syncSoundSelect("setSoundFocus", store.data.pomodoro.soundFocus, "soundFocus");
  syncSoundSelect("setSoundShort", store.data.pomodoro.soundShortBreak, "soundShortBreak");
  syncSoundSelect("setSoundLong", store.data.pomodoro.soundLongBreak, "soundLongBreak");
  syncSoundPreview("previewSoundFocus", "setSoundFocus");
  syncSoundPreview("previewSoundShort", "setSoundShort");
  syncSoundPreview("previewSoundLong", "setSoundLong");
}

export function initPomodoro() {
  syncSettingsInputs();
  setMode("focus");
  // Counter is always visible in the menu bar; it ticks while any session runs.
  void activateTray(remaining);

  document.querySelectorAll(".pomo-mode").forEach((b) => {
    (b as HTMLElement).onclick = () => setMode((b as HTMLElement).dataset.mode as Mode);
  });
  $("pomoStartBtn").onclick = toggle;
  $("pomoResetBtn").onclick = reset;
  $("pomoSkipBtn").onclick = skipSession;

  const bind = (id: string, key: "focus" | "short" | "long" | "interval") => {
    $<HTMLInputElement>(id).onchange = (e) => {
      const v = Math.max(1, parseInt((e.target as HTMLInputElement).value, 10) || 1);
      store.data.pomodoro[key] = v;
      store.persistData();
      if (!running) {
        remaining = durationFor(mode);
        renderTime();
      }
    };
  };
  bind("setFocus", "focus");
  bind("setShort", "short");
  bind("setLong", "long");
  bind("setInterval", "interval");
  $<HTMLInputElement>("setAutoStartShort").onchange = (e) => {
    store.data.pomodoro.autoStartShort = (e.target as HTMLInputElement).checked;
    store.persistData();
  };
  $<HTMLInputElement>("setAutoStartLong").onchange = (e) => {
    store.data.pomodoro.autoStartLong = (e.target as HTMLInputElement).checked;
    store.persistData();
  };

  $("pomoTaskBtn").onclick = (e) => {
    e.stopPropagation();
    toggleTaskPopover();
  };

  document.addEventListener("click", (e) => {
    if (!$("pomoTaskWrap").contains(e.target as Node)) closeTaskPopover();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeTaskPopover();
      return;
    }
    if (!isPopoverOpen() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveCursor(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveCursor(-1);
    } else if (e.key === "Enter") {
      const opt = popoverOptions()[popoverCursor];
      if (opt) {
        e.preventDefault();
        opt.click();
      }
    }
  });

  renderTaskLabel();
}
