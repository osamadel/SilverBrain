// Pomodoro view: focus / short break / long break timer with configurable
// durations. Durations and completed-session count persist via store.data.
import { store } from "../store";
import { type Quadrant } from "../config";
import { t } from "../i18n";
import { ensureNotificationPermission, showSystemNotification } from "../notifications";

const QUADRANT_BADGE_KEY: Record<Quadrant, string> = {
  q1: "todo-badge-q1",
  q2: "todo-badge-q2",
  q3: "todo-badge-q3",
  q4: "todo-badge-q4",
};

type Mode = "focus" | "short" | "long";

let mode: Mode = "focus";
let remaining = 0; // seconds
let running = false;
let ticker: number | null = null;
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

function renderTime() {
  $("pomoTime").textContent = format(remaining);
  $("pomoStartBtn").textContent = running ? t("btn-pomo-pause") : t("btn-pomo-start");
  $("pomoCount").textContent = t("pomo-sessions", { count: store.data.focusSessions });
  const outer = document.getElementById("pomoTimerOuter");
  if (outer) outer.classList.toggle("running", running);
}

function setMode(m: Mode) {
  mode = m;
  stop();
  remaining = durationFor(m);
  document.querySelectorAll(".pomo-mode").forEach((b) => {
    b.classList.toggle("active", (b as HTMLElement).dataset.mode === m);
  });
  const label = document.getElementById("pomoModeLabel");
  if (label) {
    const key = MODE_I18N_KEYS[m];
    label.dataset.i18n = key;          // keep in sync so applyLanguage() picks it up
    label.textContent = t(key);
  }
  renderTime();
}

function tick() {
  if (remaining > 0) {
    remaining--;
    renderTime();
    return;
  }
  // Timer hit zero.
  stop();
  if (mode === "focus") {
    store.data.focusSessions++;
    store.persistData();
    // Auto-suggest the appropriate break.
    const useLong = store.data.focusSessions % store.data.pomodoro.interval === 0;
    const body = t(useLong ? "notify-focus-long" : "notify-focus-short");
    notify(t("notify-title-focus-done"), body);
    setMode(useLong ? "long" : "short");
  } else {
    const body = t("notify-break-done");
    notify(t("notify-title-break-over"), body);
    setMode("focus");
  }
}

function notify(title: string, body: string) {
  void showSystemNotification(title, body);
  // A short audible beep via the Web Audio API (no asset needed).
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    /* audio not available — ignore */
  }
}

function start() {
  if (running) return;
  void ensureNotificationPermission();
  running = true;
  ticker = window.setInterval(tick, 1000);
  renderTime();
}

function stop() {
  running = false;
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

function renderTaskLabel() {
  const el = $("pomoTask");
  el.textContent = activeTaskText
    ? `${t("pomo-focusing-on")}: ${activeTaskText}`
    : t("pomo-no-task");
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

// Highlight the option at `index` (clamped/wrapped) as the keyboard cursor.
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
    // Start the keyboard cursor on the currently-selected option.
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

/** Open the task-picker popover (keyboard shortcut on the Focus page). */
export function openTaskPopover(): void {
  toggleTaskPopover(true);
}

/** Set the timer's active task label (called from Todo "focus" button). */
export function setActiveTask(text: string) {
  activeTaskText = text;
  renderTaskLabel();
}

/** Re-apply i18n strings after a language change (called from main.ts). */
export function refreshPomodoroI18n(): void {
  const label = document.getElementById("pomoModeLabel");
  if (label) {
    const key = MODE_I18N_KEYS[mode];
    label.dataset.i18n = key;
    label.textContent = t(key);
  }
  renderTaskLabel();
  renderTime(); // refreshes start/pause btn + session count
}

function syncSettingsInputs() {
  $<HTMLInputElement>("setFocus").value = String(store.data.pomodoro.focus);
  $<HTMLInputElement>("setShort").value = String(store.data.pomodoro.short);
  $<HTMLInputElement>("setLong").value = String(store.data.pomodoro.long);
  $<HTMLInputElement>("setInterval").value = String(store.data.pomodoro.interval);
}

export function initPomodoro() {
  syncSettingsInputs();
  setMode("focus");

  document.querySelectorAll(".pomo-mode").forEach((b) => {
    (b as HTMLElement).onclick = () => setMode((b as HTMLElement).dataset.mode as Mode);
  });
  $("pomoStartBtn").onclick = toggle;
  $("pomoResetBtn").onclick = reset;

  const bind = (id: string, key: keyof typeof store.data.pomodoro) => {
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
    // Arrow / Enter navigation only while the popover is open. Skip when a
    // modifier is held so the Cmd/Ctrl+↓ that opens the popover doesn't also
    // advance the cursor.
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
