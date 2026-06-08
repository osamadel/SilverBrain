// Sort page: the Eisenhower matrix plus a static left column of unsorted
// tasks. Operates on the active brain-dump session — the single source of truth
// shared with the Tasks page. Tasks carry a `quadrant`; "" means unsorted
// (shown in the list), q1–q4 means placed in that box.
import { store } from "../store";
import { loadMemory, saveMemory, uid, type Quadrant, type SessionTask } from "../config";
import { isConfigured, learnSortPreferences } from "../llm";
import { t } from "../i18n";
import { showToast, dismissToast } from "../toast";
import { wireInlineTextEdit } from "../inline-edit";

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];

let draggingId: string | null = null;
let dropIndicatorEl: HTMLElement | null = null;

let openExportDialog: (md: string) => void = () => {};
let switchToTodo: () => void = () => {};
let switchToDump: () => void = () => {};

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function tasks(): SessionTask[] {
  return store.activeSession()?.tasks ?? [];
}

function findTask(id: string): SessionTask | undefined {
  return tasks().find((x) => x.id === id);
}

/** Tasks in a quadrant/drawer group, optionally sinking completed items per settings. */
function tasksInGroup(quadrant: Quadrant | "", forDisplay = true): SessionTask[] {
  let list = tasks().filter((x) => x.quadrant === quadrant);
  if (forDisplay && store.settings.completedToBottom) {
    list = [...list.filter((x) => !x.done), ...list.filter((x) => x.done)];
  }
  return list;
}

function insertAtEndOfQuadrant(arr: SessionTask[], task: SessionTask, quadrant: Quadrant | "") {
  let lastIdx = -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].quadrant === quadrant) lastIdx = i;
  }
  arr.splice(lastIdx + 1, 0, task);
}

function clearDropIndicator() {
  dropIndicatorEl?.classList.remove("drop-before", "drop-after");
  dropIndicatorEl = null;
}

function clearDropTargets() {
  for (const q of QUADRANTS) $(q).classList.remove("drag-over");
  $("sortDrawerList").classList.remove("drag-over");
}

/** Move a task to a quadrant and optional position within that group. */
function reorderTask(
  draggedId: string,
  targetQuadrant: Quadrant | "",
  anchorId: string | null,
  placeAfter: boolean,
) {
  const session = store.activeSession();
  if (!session) return;
  const arr = session.tasks;
  const fromIdx = arr.findIndex((t) => t.id === draggedId);
  if (fromIdx === -1) return;

  const [task] = arr.splice(fromIdx, 1);
  task.quadrant = targetQuadrant;

  const displayed = tasksInGroup(targetQuadrant, true).filter((t) => t.id !== draggedId);
  let insertBeforeId: string | null = null;

  if (anchorId) {
    const anchorIdx = displayed.findIndex((t) => t.id === anchorId);
    if (anchorIdx !== -1) {
      insertBeforeId = placeAfter ? (displayed[anchorIdx + 1]?.id ?? null) : anchorId;
    }
  }

  if (insertBeforeId === null) {
    insertAtEndOfQuadrant(arr, task, targetQuadrant);
  } else {
    const toIdx = arr.findIndex((t) => t.id === insertBeforeId);
    arr.splice(toIdx >= 0 ? toIdx : arr.length, 0, task);
  }

  store.persistData();
  clearDropTargets();
  clearDropIndicator();
  renderSort();
}

function setQuadrant(id: string, quadrant: Quadrant | "") {
  if (!findTask(id)) return;
  reorderTask(id, quadrant, null, false);
}

function toggleDone(id: string) {
  const task = findTask(id);
  if (!task) return;
  task.done = !task.done;
  store.persistData();
  renderSort();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function makeChip(task: SessionTask, opts: { removable: boolean }): HTMLElement {
  const el = document.createElement("div");
  el.className =
    (opts.removable ? "placed-task" : "task-item") + (task.done ? " done" : "");
  el.draggable = true;
  el.dataset.id = task.id;

  const check = document.createElement("button");
  check.type = "button";
  check.className = "sort-check" + (task.done ? " checked" : "");
  check.textContent = task.done ? "✓" : "";
  check.title = t("sort-toggle-done");
  check.onclick = (ev) => {
    ev.stopPropagation();
    toggleDone(task.id);
  };
  check.onmousedown = (ev) => ev.stopPropagation();
  el.appendChild(check);

  const txt = document.createElement("span");
  txt.className = "sort-task-text";
  txt.textContent = task.text;
  wireInlineTextEdit(txt, {
    getText: () => findTask(task.id)?.text ?? task.text,
    onCommit: (text) => {
      const current = findTask(task.id);
      if (!current) return;
      current.text = text;
      store.persistData();
      renderSort();
    },
    onEditStart: () => {
      el.draggable = false;
    },
    onEditEnd: () => {
      el.draggable = true;
    },
  });
  el.appendChild(txt);

  if (!opts.removable) {
    const icon = document.createElement("span");
    icon.className = "task-drag-icon";
    icon.textContent = "⠿";
    el.appendChild(icon);
  } else {
    const rm = document.createElement("button");
    rm.className = "rm-btn";
    rm.textContent = "×";
    rm.title = "Return to drawer";
    rm.onclick = (ev) => {
      ev.stopPropagation();
      setQuadrant(task.id, "");
    };
    el.appendChild(rm);
  }

  el.addEventListener("dragstart", (e) => {
    draggingId = task.id;
    el.classList.add("dragging");
    e.dataTransfer!.effectAllowed = "move";
  });
  el.addEventListener("dragend", () => {
    el.classList.remove("dragging");
    draggingId = null;
    clearDropIndicator();
    clearDropTargets();
  });

  wireChipDrop(el, task, opts.removable ? task.quadrant : "");
  return el;
}

function wireChipDrop(el: HTMLElement, task: SessionTask, quadrant: Quadrant | "") {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingId || draggingId === task.id) return;
    e.dataTransfer!.dropEffect = "move";
    clearDropTargets();
    const rect = el.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    if (dropIndicatorEl !== el) {
      clearDropIndicator();
      dropIndicatorEl = el;
    }
    el.classList.toggle("drop-before", !after);
    el.classList.toggle("drop-after", after);
  });
  el.addEventListener("dragleave", (e) => {
    if (el.contains(e.relatedTarget as Node)) return;
    if (dropIndicatorEl === el) clearDropIndicator();
  });
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearDropIndicator();
    clearDropTargets();
    if (!draggingId || draggingId === task.id) return;
    const rect = el.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    reorderTask(draggingId, quadrant, task.id, after);
  });
}

function renderDrawer() {
  const list = $("sortDrawerList");
  const count = $("drawerCount");
  const unsorted = tasksInGroup("");

  count.textContent = String(unsorted.length);
  list.innerHTML = "";
  if (!unsorted.length) {
    list.innerHTML = `<div class="tasks-empty">${t("drawer-empty")}</div>`;
    return;
  }
  for (const task of unsorted) list.appendChild(makeChip(task, { removable: false }));
}

function renderMatrix() {
  for (const q of QUADRANTS) {
    const container = $(q);
    container.querySelectorAll(".placed-task").forEach((el) => el.remove());
    const placed = tasksInGroup(q);
    const hint = $(`hint-${q}`);
    hint.classList.toggle("hidden", placed.length > 0);
    for (const task of placed) container.appendChild(makeChip(task, { removable: true }));
  }
}

export function renderSort() {
  clearDropTargets();
  clearDropIndicator();
  renderDrawer();
  renderMatrix();
}

// ── Drag-and-drop wiring ────────────────────────────────────────────────────────

function wireDropTarget(el: HTMLElement, quadrant: Quadrant | "") {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    clearDropTargets();
    el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", (e) => {
    if (el.contains(e.relatedTarget as Node)) return;
    el.classList.remove("drag-over");
  });
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("drag-over");
    if (!draggingId) return;
    reorderTask(draggingId, quadrant, null, false);
  });
}

// ── Markdown export ─────────────────────────────────────────────────────────────

function generateMarkdown(): string {
  const session = store.activeSession();
  const today = new Date().toISOString().split("T")[0];
  const title = session?.title ? `${session.title} — ${today}` : `Eisenhower Matrix — ${today}`;
  let md = `# ${title}\n\n> Organized using the Eisenhower decision matrix\n\n---\n\n`;
  const sections = [
    { key: "q1" as Quadrant, emoji: "🔴", title: "Do First", sub: "Urgent + Important" },
    { key: "q2" as Quadrant, emoji: "🔵", title: "Schedule", sub: "Not Urgent + Important" },
    { key: "q3" as Quadrant, emoji: "🟢", title: "Delegate", sub: "Urgent + Not Important" },
    { key: "q4" as Quadrant, emoji: "⚫", title: "Eliminate", sub: "Not Urgent + Not Important" },
  ];
  for (const s of sections) {
    md += `## ${s.emoji} ${s.title}\n*${s.sub}*\n\n`;
    const items = tasksInGroup(s.key);
    if (items.length) for (const it of items) md += `- [${it.done ? "x" : " "}] ${it.text}\n`;
    else md += `- *(none)*\n`;
    md += "\n";
  }
  md += `---\n*Generated with SilverBrain*`;
  return md;
}

const LEARN_TOAST_ID = "learn-prefs";

async function finishSorting() {
  const session = store.activeSession();
  const list = session?.tasks ?? [];

  // Navigate to Tasks immediately — learning preferences happens in the
  // background so the app never appears to hang.
  switchToTodo();

  if (!session || list.length === 0 || !isConfigured(store.settings)) return;

  showToast({
    id: LEARN_TOAST_ID,
    type: "info",
    message: t("status-learning-memory"),
    messageKey: "status-learning-memory",
    duration: null,
  });

  try {
    const existingMemory = await loadMemory();
    const newMemory = await learnSortPreferences(store.settings, {
      dump: session.dump,
      existingMemory,
      tasks: list.map((task) => ({
        text: task.text,
        suggested: task.suggestedQuadrant ?? task.quadrant ?? "",
        final: task.quadrant,
      })),
    });
    await saveMemory(newMemory);
    dismissToast(LEARN_TOAST_ID);
    showToast({ type: "success", message: t("status-learned") });
  } catch (e) {
    console.error(e);
    dismissToast(LEARN_TOAST_ID);
    showToast({
      type: "warning",
      message: t("status-learn-failed"),
      messageKey: "status-learn-failed",
    });
  }
}

/** Trigger Finish Sorting from a keyboard shortcut. */
export function requestFinishSort() {
  void finishSorting();
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initSort(opts: {
  openExportDialog: (md: string) => void;
  switchToTodo: () => void;
  switchToDump: () => void;
}) {
  openExportDialog = opts.openExportDialog;
  switchToTodo = opts.switchToTodo;
  switchToDump = opts.switchToDump;

  for (const q of QUADRANTS) wireDropTarget($(q), q);
  wireDropTarget($("sortDrawerList"), "");

  $<HTMLFormElement>("drawerAddForm").onsubmit = (e) => {
    e.preventDefault();
    const input = $<HTMLInputElement>("drawerAddInput");
    const text = input.value.trim();
    if (!text) return;
    store.ensureActiveSession().tasks.push({ id: uid(), text, quadrant: "", done: false });
    input.value = "";
    store.persistData();
    renderSort();
  };

  $("exportBtn").onclick = () => openExportDialog(generateMarkdown());
  $("finishSortBtn").onclick = () => void finishSorting();
  $("sortBackBtn").onclick = switchToDump;

  renderSort();
}
