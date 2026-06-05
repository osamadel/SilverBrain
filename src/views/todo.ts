// Tasks view: a persistent checklist over the ACTIVE session's tasks (the same
// list the Sort page shows). Items carry an Eisenhower quadrant badge and can
// be sent to the Pomodoro timer as the active task. Adding/removing here is
// reflected on the Sort page and vice-versa — one source of truth.
import { store } from "../store";
import { uid, type Quadrant, type SessionTask } from "../config";
import { t } from "../i18n";

const QUADRANT_BADGE_KEY: Record<Quadrant, string> = {
  q1: "todo-badge-q1",
  q2: "todo-badge-q2",
  q3: "todo-badge-q3",
  q4: "todo-badge-q4",
};

let onFocusTask: (text: string) => void = () => {};

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

// Groups rendered in Eisenhower priority order, mirroring the markdown export;
// "" (no quadrant) sorts last under "Unsorted".
const GROUP_I18N_KEYS: { key: Quadrant | ""; labelKey: string }[] = [
  { key: "q1", labelKey: "todo-group-q1" },
  { key: "q2", labelKey: "todo-group-q2" },
  { key: "q3", labelKey: "todo-group-q3" },
  { key: "q4", labelKey: "todo-group-q4" },
  { key: "",   labelKey: "todo-group-unsorted" },
];

function render() {
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
  row.appendChild(text);

  if (item.quadrant) {
    const badge = document.createElement("span");
    badge.className = "todo-badge " + item.quadrant;
    badge.textContent = t(QUADRANT_BADGE_KEY[item.quadrant]);
    row.appendChild(badge);
  }

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
  del.onclick = () => {
    const session = store.activeSession();
    if (session) session.tasks = session.tasks.filter((x) => x.id !== item.id);
    store.persistData();
    render();
  };
  row.appendChild(del);

  return row;
}

/** Re-render the list (called on language change and when entering the view). */
export function refreshTodoI18n(): void {
  render();
}

/** Send the first task in the list to the Focus timer (keyboard shortcut). */
export function focusFirstTask(): void {
  const first = tasks()[0];
  if (first) onFocusTask(first.text);
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

  $("clearDoneBtn").onclick = () => {
    const session = store.activeSession();
    if (session) session.tasks = session.tasks.filter((x) => !x.done);
    store.persistData();
    render();
  };

  $("toggleDoneBtn").onclick = () => {
    showCompleted = !showCompleted;
    render();
  };

  render();
}
