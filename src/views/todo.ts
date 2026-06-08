// Tasks view: a persistent checklist over the ACTIVE session's tasks (the same
// list the Sort page shows). Items carry an Eisenhower quadrant badge and can
// be sent to the Pomodoro timer as the active task. Adding/removing here is
// reflected on the Sort page and vice-versa — one source of truth.
import { store } from "../store";
import { uid, type Quadrant, type SessionTask } from "../config";
import { t } from "../i18n";
import { wireInlineTextEdit, beginInlineTextEdit, type InlineTextEditOpts } from "../inline-edit";
import { showConfirmDialog } from "../confirm-dialog";

const QUADRANT_BADGE_KEY: Record<Quadrant, string> = {
  q1: "todo-badge-q1",
  q2: "todo-badge-q2",
  q3: "todo-badge-q3",
  q4: "todo-badge-q4",
};

const QUADRANT_PICKER_OPTIONS: { key: Quadrant | ""; labelKey: string }[] = [
  { key: "q1", labelKey: "todo-opt-q1" },
  { key: "q2", labelKey: "todo-opt-q2" },
  { key: "q3", labelKey: "todo-opt-q3" },
  { key: "q4", labelKey: "todo-opt-q4" },
  { key: "", labelKey: "todo-opt-none" },
];

let onFocusTask: (text: string) => void = () => {};
let openQuadrantPicker: HTMLElement | null = null;
let quadrantPickerAnchor: HTMLElement | null = null;
let pickerCursor = 0;
let pickerItem: SessionTask | null = null;

// Completed tasks are hidden by default; the footer toggle reveals them. This
// is view-local state (not persisted) — reopening the app starts collapsed.
let showCompleted = false;

// Keyboard focus cursor for ↑/↓ cycling. `focusedId` is the highlighted row;
// `visibleIds` is the flattened render order used to step between rows.
let focusedId: string | null = null;
let visibleIds: string[] = [];

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function tasks(): SessionTask[] {
  return store.activeSession()?.tasks ?? [];
}

function closeQuadrantPicker() {
  openQuadrantPicker?.remove();
  openQuadrantPicker = null;
  quadrantPickerAnchor = null;
  pickerItem = null;
}

function updatePickerCursor() {
  if (!openQuadrantPicker) return;
  const opts = openQuadrantPicker.querySelectorAll<HTMLElement>(".quadrant-picker-option");
  opts.forEach((o, i) => o.classList.toggle("active", i === pickerCursor));
  opts[pickerCursor]?.scrollIntoView({ block: "nearest" });
}

function initPickerKeyboard(item: SessionTask) {
  pickerItem = item;
  if (!openQuadrantPicker) return;
  const opts = openQuadrantPicker.querySelectorAll(".quadrant-picker-option");
  pickerCursor = Math.max(0, [...opts].findIndex((o) => o.classList.contains("selected")));
  updatePickerCursor();
}

function setTaskQuadrant(item: SessionTask, quadrant: Quadrant | "") {
  if (item.quadrant === quadrant) {
    closeQuadrantPicker();
    return;
  }
  item.quadrant = quadrant;
  store.persistData();
  closeQuadrantPicker();
  render();
}

function openQuadrantMenu(anchor: HTMLElement, item: SessionTask) {
  if (quadrantPickerAnchor === anchor) {
    closeQuadrantPicker();
    return;
  }
  closeQuadrantPicker();

  const menu = document.createElement("div");
  menu.className = "quadrant-picker";
  menu.setAttribute("role", "menu");

  for (const opt of QUADRANT_PICKER_OPTIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "quadrant-picker-option" +
      (opt.key ? " qp-" + opt.key : "") +
      ((item.quadrant || "") === opt.key ? " selected" : "");
    btn.setAttribute("role", "menuitemradio");
    btn.setAttribute("aria-checked", String((item.quadrant || "") === opt.key));
    btn.textContent = t(opt.labelKey);
    btn.onclick = (ev) => {
      ev.stopPropagation();
      setTaskQuadrant(item, opt.key);
    };
    menu.appendChild(btn);
  }

  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, rect.left + rect.width / 2 - menu.offsetWidth / 2)}px`;

  openQuadrantPicker = menu;
  quadrantPickerAnchor = anchor;
  initPickerKeyboard(item);

  const onOutside = (ev: MouseEvent) => {
    if (menu.contains(ev.target as Node) || anchor.contains(ev.target as Node)) return;
    closeQuadrantPicker();
    document.removeEventListener("mousedown", onOutside);
  };
  requestAnimationFrame(() => document.addEventListener("mousedown", onOutside));
}

// Groups rendered in Eisenhower priority order, mirroring the markdown export;
// "" (no quadrant) sorts last under "Unsorted".
const GROUP_I18N_KEYS: { key: Quadrant | ""; labelKey: string }[] = [
  { key: "q1", labelKey: "todo-group-q1" },
  { key: "q2", labelKey: "todo-group-q2" },
  { key: "q3", labelKey: "todo-group-q3" },
  { key: "q4", labelKey: "todo-group-q4" },
  { key: "",   labelKey: "todo-group-unsorted" },
];

export function refreshTodo() {
  render();
}

function render() {
  closeQuadrantPicker();
  const list = $("todoList");
  const items = tasks();
  list.innerHTML = "";

  const doneCount = items.filter((item) => item.done).length;
  visibleIds = [];

  if (!items.length) {
    list.innerHTML = `<div class="todo-empty">${t("todo-empty")}</div>`;
  } else {
    // Render-time grouping/ordering only — does not reorder the stored array.
    for (const group of GROUP_I18N_KEYS) {
      let inGroup = items.filter((item) => (item.quadrant || "") === group.key);
      // Hide completed tasks unless the user has chosen to reveal them.
      if (!showCompleted) inGroup = inGroup.filter((item) => !item.done);
      // Sink completed tasks to the bottom of the quadrant when configured.
      if (showCompleted && store.settings.completedToBottom) {
        inGroup = [...inGroup.filter((item) => !item.done), ...inGroup.filter((item) => item.done)];
      }
      if (!inGroup.length) continue;
      const heading = document.createElement("div");
      heading.className = "todo-group-label" + (group.key ? " tg-" + group.key : "");
      heading.textContent = t(group.labelKey);
      list.appendChild(heading);
      for (const item of inGroup) {
        list.appendChild(renderItem(item));
        visibleIds.push(item.id);
      }
    }
  }

  // Drop a stale focus cursor if its task is no longer visible.
  if (focusedId && !visibleIds.includes(focusedId)) focusedId = null;

  const remaining = items.filter((item) => !item.done).length;
  $("todoStats").textContent = t("todo-stats", { open: remaining, total: items.length });

  // Footer toggle: only meaningful when completed tasks exist.
  const toggle = $<HTMLButtonElement>("toggleDoneBtn");
  toggle.style.display = doneCount ? "" : "none";
  toggle.textContent = t(showCompleted ? "btn-hide-done" : "btn-show-done");
}

function taskPreview(text: string, max = 80): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max - 1) + "…";
}

function removeTaskById(id: string): void {
  const session = store.activeSession();
  if (!session) return;
  session.tasks = session.tasks.filter((x) => x.id !== id);
  if (focusedId === id) focusedId = null;
  store.persistData();
  render();
}

/** Prompt before deleting a task by id. */
export function requestDeleteTask(id: string): void {
  const item = tasks().find((x) => x.id === id);
  if (!item) return;
  showConfirmDialog({
    titleKey: "delete-task-title",
    messageKey: "delete-task-msg",
    messageVars: { text: taskPreview(item.text) },
    onConfirm: () => removeTaskById(id),
  });
}

/** Prompt before deleting the keyboard-highlighted task. */
export function requestDeleteFocusedTask(): void {
  if (!focusedId) return;
  requestDeleteTask(focusedId);
}

/** Prompt before clearing all completed tasks. */
export function requestClearCompletedTasks(): void {
  const done = tasks().filter((item) => item.done);
  if (!done.length) return;
  showConfirmDialog({
    titleKey: "delete-done-title",
    messageKey: "delete-done-msg",
    messageVars: { count: done.length },
    onConfirm: () => {
      const session = store.activeSession();
      if (!session) return;
      session.tasks = session.tasks.filter((x) => !x.done);
      if (focusedId && !session.tasks.some((x) => x.id === focusedId)) focusedId = null;
      store.persistData();
      render();
    },
  });
}

function taskTextEditOpts(item: SessionTask): InlineTextEditOpts {
  return {
    getText: () => tasks().find((x) => x.id === item.id)?.text ?? item.text,
    onCommit: (newText) => {
      const current = tasks().find((x) => x.id === item.id);
      if (!current) return;
      current.text = newText;
      store.persistData();
      render();
    },
  };
}

function renderItem(item: SessionTask): HTMLElement {
  const row = document.createElement("div");
  row.className =
    "todo-item" + (item.done ? " done" : "") + (item.id === focusedId ? " focused" : "");

  const check = document.createElement("div");
  check.className = "todo-check" + (item.done ? " checked" : "");
  check.textContent = item.done ? "✓" : "";
  check.title = "Toggle complete";
  check.onclick = () => {
    item.done = !item.done;
    store.persistData();
    render();
  };
  row.appendChild(check);

  const text = document.createElement("div");
  text.className = "todo-text";
  text.textContent = item.text;
  wireInlineTextEdit(text, taskTextEditOpts(item));
  row.appendChild(text);

  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = "todo-badge todo-badge-btn " + (item.quadrant || "q-none");
  badge.textContent = item.quadrant ? t(QUADRANT_BADGE_KEY[item.quadrant]) : t("todo-opt-none");
  badge.title = t("todo-change-quadrant");
  badge.setAttribute("aria-haspopup", "menu");
  badge.onclick = (ev) => {
    ev.stopPropagation();
    openQuadrantMenu(badge, item);
  };
  row.appendChild(badge);

  const focusBtn = document.createElement("button");
  focusBtn.className = "todo-focus-btn";
  focusBtn.textContent = "▶";
  focusBtn.title = "Focus on this in Pomodoro";
  focusBtn.onclick = () => onFocusTask(item.text);
  row.appendChild(focusBtn);

  const del = document.createElement("button");
  del.className = "todo-del-btn";
  del.textContent = "✕";
  del.title = "Delete";
  del.onclick = () => requestDeleteTask(item.id);
  row.appendChild(del);

  return row;
}

/** Re-render the list (called on language change and when entering the view). */
export function refreshTodoI18n(): void {
  render();
}

/** Whether the quadrant picker menu is open (Tasks page). */
export function isQuadrantPickerOpen(): boolean {
  return openQuadrantPicker !== null;
}

/** Close the quadrant picker without changing the task. */
export function closeQuadrantPickerMenu(): void {
  closeQuadrantPicker();
}

/** Open the quadrant picker for the keyboard-highlighted task (Space on Tasks page). */
export function openFocusedQuadrantPicker(): void {
  if (!focusedId) return;
  const item = tasks().find((x) => x.id === focusedId);
  if (!item) return;
  const badge = document.querySelector(".todo-item.focused .todo-badge-btn") as HTMLElement | null;
  const anchor = badge ?? (document.querySelector(".todo-item.focused") as HTMLElement | null);
  if (!anchor) return;
  openQuadrantMenu(anchor, item);
}

/** Move keyboard focus within the open quadrant picker. */
export function moveQuadrantPickerFocus(delta: number): void {
  if (!openQuadrantPicker) return;
  const count = openQuadrantPicker.querySelectorAll(".quadrant-picker-option").length;
  if (!count) return;
  pickerCursor = (pickerCursor + delta + count) % count;
  updatePickerCursor();
}

/** Apply the highlighted quadrant picker option. */
export function selectFocusedQuadrantOption(): void {
  if (!openQuadrantPicker || !pickerItem) return;
  const opt = QUADRANT_PICKER_OPTIONS[pickerCursor];
  if (opt) setTaskQuadrant(pickerItem, opt.key);
}

/** Start inline editing on the keyboard-highlighted task (Enter on Tasks page). */
export function editFocusedTask(): void {
  if (!focusedId) return;
  const item = tasks().find((x) => x.id === focusedId);
  if (!item) return;
  const textEl = document.querySelector(".todo-item.focused .todo-text") as HTMLElement | null;
  if (!textEl) return;
  beginInlineTextEdit(textEl, taskTextEditOpts(item));
}

/** Send the keyboard-highlighted task to the Focus timer (Cmd/Ctrl+Enter). */
export function focusHighlightedTask(): void {
  if (!focusedId) return;
  const item = tasks().find((x) => x.id === focusedId);
  if (item) onFocusTask(item.text);
}

/** Move the keyboard focus cursor up (delta -1) or down (delta +1). */
export function moveTaskFocus(delta: number): void {
  if (!visibleIds.length) return;
  const at = focusedId ? visibleIds.indexOf(focusedId) : -1;
  const next = at === -1 ? (delta > 0 ? 0 : visibleIds.length - 1)
                        : (at + delta + visibleIds.length) % visibleIds.length;
  focusedId = visibleIds[next];
  render();
  document.querySelector(".todo-item.focused")?.scrollIntoView({ block: "nearest" });
}

/** Toggle the done state of the keyboard-focused task (Cmd/Ctrl+L). */
export function toggleFocusedTaskDone(): void {
  if (!focusedId) return;
  const item = tasks().find((x) => x.id === focusedId);
  if (!item) return;
  // Remember the row position so focus lands sensibly if toggling hides the task.
  const at = visibleIds.indexOf(focusedId);
  item.done = !item.done;
  store.persistData();
  render();
  if (!visibleIds.includes(item.id) && visibleIds.length) {
    focusedId = visibleIds[Math.min(at, visibleIds.length - 1)];
    render();
  }
}

export function initTodo(opts: { onFocusTask: (text: string) => void }) {
  onFocusTask = opts.onFocusTask;

  const form = $<HTMLFormElement>("todoForm");
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("todoInput");
    const quad = $<HTMLSelectElement>("todoQuadrant");
    const text = input.value.trim();
    if (!text) return;
    store.ensureActiveSession().tasks.push({
      id: uid(),
      text,
      done: false,
      quadrant: (quad.value as Quadrant | "") || "",
    });
    input.value = "";
    store.persistData();
    render();
  };

  $("clearDoneBtn").onclick = () => requestClearCompletedTasks();

  $("toggleDoneBtn").onclick = () => {
    showCompleted = !showCompleted;
    render();
  };

  render();
}
