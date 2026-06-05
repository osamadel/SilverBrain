// Sort page: the Eisenhower matrix plus a static left column of unsorted
// tasks. Operates on the active brain-dump session — the single source of truth
// shared with the Tasks page. Tasks carry a `quadrant`; "" means unsorted
// (shown in the list), q1–q4 means placed in that box.
import { store } from "../store";
import { loadMemory, saveMemory, uid, type Quadrant, type SessionTask } from "../config";
import { isConfigured, learnSortPreferences } from "../llm";
import { t } from "../i18n";
import { showToast, dismissToast } from "../toast";

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];

let draggingId: string | null = null;

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

function setQuadrant(id: string, quadrant: Quadrant | "") {
  const task = findTask(id);
  if (!task || task.quadrant === quadrant) return;
  task.quadrant = quadrant;
  store.persistData();
  renderSort();
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function makeChip(task: SessionTask, opts: { removable: boolean }): HTMLElement {
  const el = document.createElement("div");
  el.className = opts.removable ? "placed-task" : "task-item";
  el.draggable = true;
  el.dataset.id = task.id;

  const txt = document.createElement("span");
  txt.textContent = task.text;
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
  });
  return el;
}

function renderDrawer() {
  const list = $("sortDrawerList");
  const count = $("drawerCount");
  const unsorted = tasks().filter((x) => x.quadrant === "");

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
    const placed = tasks().filter((x) => x.quadrant === q);
    const hint = $(`hint-${q}`);
    hint.classList.toggle("hidden", placed.length > 0);
    for (const task of placed) container.appendChild(makeChip(task, { removable: true }));
  }
}

export function renderSort() {
  renderDrawer();
  renderMatrix();
}

// ── Drag-and-drop wiring ────────────────────────────────────────────────────────

function wireDropTarget(el: HTMLElement, quadrant: Quadrant | "") {
  el.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";
    el.classList.add("drag-over");
  });
  el.addEventListener("dragleave", () => el.classList.remove("drag-over"));
  el.addEventListener("drop", (e) => {
    e.preventDefault();
    el.classList.remove("drag-over");
    if (draggingId) setQuadrant(draggingId, quadrant);
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
    const items = tasks().filter((x) => x.quadrant === s.key);
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
  wireDropTarget($("sortDrawer"), "");

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
