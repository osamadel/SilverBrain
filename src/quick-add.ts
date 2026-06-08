// macOS quick-add overlay — double-Ctrl toggles this window system-wide.
import { store } from "./store";
import { saveData, uid, type Quadrant } from "./config";
import { applyLanguage, t } from "./i18n";

export const QUICK_ADD_TASK_EVENT = "quick-add:task-added";

type QuickAddQuadrant = Quadrant | "";

const QUADRANTS: { key: QuickAddQuadrant; labelKey: string; badgeKey?: string }[] = [
  { key: "", labelKey: "todo-opt-none" },
  { key: "q1", labelKey: "todo-opt-q1", badgeKey: "todo-badge-q1" },
  { key: "q2", labelKey: "todo-opt-q2", badgeKey: "todo-badge-q2" },
  { key: "q3", labelKey: "todo-opt-q3", badgeKey: "todo-badge-q3" },
  { key: "q4", labelKey: "todo-opt-q4", badgeKey: "todo-badge-q4" },
];

let selectedQuadrant: QuickAddQuadrant = "";
let pickerOpen = false;
let pickerCursor = 0;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function quadrantIndex(key: QuickAddQuadrant): number {
  return QUADRANTS.findIndex((q) => q.key === key);
}

function updateBadge() {
  const btn = $<HTMLButtonElement>("quickAddQuadrant");
  const q = QUADRANTS.find((x) => x.key === selectedQuadrant) ?? QUADRANTS[0];
  btn.className = q.key
    ? `todo-badge todo-badge-btn ${q.key}`
    : "todo-badge todo-badge-btn q-none";
  btn.textContent = t(q.badgeKey ?? q.labelKey);
  btn.title = t("todo-change-quadrant");
}

function focusInput() {
  const input = $<HTMLInputElement>("quickAddInput");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => input.focus({ preventScroll: true }));
  });
}

function closePicker() {
  pickerOpen = false;
  const picker = $("quickAddPicker");
  picker.classList.add("hidden");
  picker.hidden = true;
  picker.innerHTML = "";
  $<HTMLButtonElement>("quickAddQuadrant").setAttribute("aria-expanded", "false");
}

function positionPicker() {
  const picker = $("quickAddPicker");
  const badge = $<HTMLButtonElement>("quickAddQuadrant");
  const rect = badge.getBoundingClientRect();
  const pickerH = picker.offsetHeight || 168;
  // Bar sits at the bottom — open the menu upward.
  picker.style.top = `${Math.max(8, rect.top - pickerH - 8)}px`;
  picker.style.left = `${Math.max(12, rect.right - picker.offsetWidth)}px`;
}

function updatePickerCursor() {
  const picker = $("quickAddPicker");
  const opts = picker.querySelectorAll<HTMLElement>(".quadrant-picker-option");
  opts.forEach((o, i) => o.classList.toggle("active", i === pickerCursor));
  opts[pickerCursor]?.scrollIntoView({ block: "nearest" });
}

function selectQuadrant(key: QuickAddQuadrant) {
  selectedQuadrant = key;
  updateBadge();
  closePicker();
  focusInput();
}

function openPicker() {
  if (pickerOpen) return;
  pickerOpen = true;
  pickerCursor = Math.max(0, quadrantIndex(selectedQuadrant));

  const picker = $("quickAddPicker");
  picker.innerHTML = "";
  for (const q of QUADRANTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "quadrant-picker-option" +
      (q.key ? ` qp-${q.key}` : "") +
      (selectedQuadrant === q.key ? " selected" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(selectedQuadrant === q.key));
    btn.textContent = t(q.labelKey);
    btn.onclick = (ev) => {
      ev.stopPropagation();
      selectQuadrant(q.key);
    };
    picker.appendChild(btn);
  }

  picker.classList.remove("hidden");
  picker.hidden = false;
  $<HTMLButtonElement>("quickAddQuadrant").setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => {
    positionPicker();
    updatePickerCursor();
  });
}

function resetForm() {
  selectedQuadrant = "";
  closePicker();
  const input = $<HTMLInputElement>("quickAddInput");
  input.value = "";
  updateBadge();
  focusInput();
}

async function hideOverlay() {
  closePicker();
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

async function submitTask() {
  if (pickerOpen) {
    selectQuadrant(QUADRANTS[pickerCursor]?.key ?? selectedQuadrant);
    return;
  }

  const input = $<HTMLInputElement>("quickAddInput");
  const text = input.value.trim();
  if (!text) return;

  const task = {
    id: uid(),
    text,
    done: false,
    quadrant: selectedQuadrant,
  };

  store.ensureActiveSession().tasks.push(task);
  await saveData(store.data);

  if (isTauri()) {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(QUICK_ADD_TASK_EVENT, { task });
  }

  await hideOverlay();
}

function wireKeyboard() {
  const input = $<HTMLInputElement>("quickAddInput");
  const badge = $<HTMLButtonElement>("quickAddQuadrant");

  badge.onclick = (e) => {
    e.preventDefault();
    if (pickerOpen) closePicker();
    else openPicker();
    focusInput();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (pickerOpen) {
        closePicker();
        focusInput();
      } else {
        void hideOverlay();
      }
      return;
    }

    if (pickerOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        pickerCursor = (pickerCursor + 1) % QUADRANTS.length;
        updatePickerCursor();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        pickerCursor = (pickerCursor - 1 + QUADRANTS.length) % QUADRANTS.length;
        updatePickerCursor();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        selectQuadrant(QUADRANTS[pickerCursor]?.key ?? selectedQuadrant);
        return;
      }
    }

    if (e.key === "ArrowDown" && !pickerOpen) {
      e.preventDefault();
      openPicker();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      void submitTask();
    }
  });

  $("quickAddOverlay").onclick = (e) => {
    if (e.target === e.currentTarget) void hideOverlay();
  };

  $("quickAddForm").onsubmit = (e) => {
    e.preventDefault();
    void submitTask();
  };

  window.addEventListener("resize", () => {
    if (pickerOpen) positionPicker();
  });
}

async function wireTauriEvents() {
  if (!isTauri()) return;
  const { listen } = await import("@tauri-apps/api/event");
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();

  await listen("quick-add:show", () => resetForm());
  await listen("quick-add:hide", () => closePicker());
  await win.listen("tauri://focus", () => resetForm());
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) resetForm();
  });
}

function initTheme() {
  try {
    document.documentElement.classList.toggle(
      "light",
      localStorage.getItem("sb-theme") === "light",
    );
  } catch {
    /* storage unavailable */
  }
}

async function main() {
  initTheme();
  await store.init();
  applyLanguage((store.settings.language ?? "en") as "en" | "ar");
  updateBadge();
  wireKeyboard();
  await wireTauriEvents();
}

main().catch((e) => console.error("Quick-add overlay failed:", e));
