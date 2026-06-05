# Change set — Brain Dump wizard / DnD fix / grouped Todo

No VCS in this project; this is a hand-assembled diff of all changes.

## src-tauri/tauri.conf.json
Window object gains one key:
```diff
         "minWidth": 880,
-        "minHeight": 600
+        "minHeight": 600,
+        "dragDropEnabled": false
       }
```

## index.html  (#view-braindump body restructured)
The single `.main` (left-col = dump section + tasks-section, plus matrix-col) became two sibling screens under `.steps`:

```html
  <!-- SCREEN 1: focused brain dump -->
  <div class="bd-screen" id="bd-screen-dump">
    <div class="dump-card">
      <div class="section-label">Your brain dump</div>
      <textarea class="dump-textarea" id="dumpInput" placeholder="..."></textarea>
      <div class="no-key-warning" id="noKeyWarning">
        <span>⚠ No provider configured.</span>
        <button id="noKeyOpenBtn">Open settings</button>
      </div>
      <div class="status-line">
        <div class="spinner" id="spinner"></div>
        <span id="statusText"></span>
      </div>
      <button class="btn-primary" id="extractBtn"> ... Extract tasks</button>
      <button class="btn-secondary" id="resetBtn" style="display:none">Reset everything</button>
    </div>
  </div>

  <!-- SCREEN 2: drag & sort + export -->
  <div class="bd-screen hidden" id="bd-screen-sort">
  <div class="main">
    <div class="left-col">
      <div class="bd-back-row">
        <button class="bd-back" id="backToDumpBtn">← Edit dump</button>
      </div>
      <div class="tasks-section" id="tasksSection">
        <div class="tasks-header">
          <div class="section-label">Tasks</div>
          <span class="tasks-count" id="tasksCount" style="display:none">0</span>
        </div>
        <div class="tasks-list" id="tasksList"> ...empty hint... </div>
      </div>
    </div>
    <div class="matrix-col"> ...unchanged matrix markup (q1..q4)... </div>
  </div>
  <div class="bottom-bar"> ...unchanged (sendToTodoBtn, generateBtn)... </div>
  <div class="output-section" id="outputSection"> ...unchanged... </div>
  </div><!-- /#bd-screen-sort -->
```
(The dump `<section>` wrapper class became `.dump-card`; tasks-section moved from
the dump column into the sort screen's left-col, preceded by a back-button row.)

## src/views/braindump.ts
Added wizard helpers and rewired navigation:
```ts
// Wizard: screen 1 = focused dump, screen 2 = task list + matrix + export.
function showDumpScreen() {
  $("bd-screen-dump").classList.remove("hidden");
  $("bd-screen-sort").classList.add("hidden");
  updateSteps(1);
}
function showSortScreen() {
  $("bd-screen-dump").classList.add("hidden");
  $("bd-screen-sort").classList.remove("hidden");
  updateSteps(placedCount() > 0 ? 3 : 2);
}
```
- In `runExtract` success path: replaced `updateSteps(2)` with `showSortScreen()`.
- In `resetAll`: replaced trailing `updateSteps(1)` with `showDumpScreen()`.
- In `initBrainDump`: added `$("backToDumpBtn").onclick = showDumpScreen;`
- In `initBrainDump` tail, replaced the old `if (store.data.tasks.length){...updateSteps(...)}`
  with:
```ts
  if (store.data.tasks.length) {
    $("resetBtn").style.display = "flex";
    showSortScreen();
  } else {
    showDumpScreen();
  }
```
`placedCount()`, `updateSteps()`, DnD handlers (`wireQuadrantDnd`, dragstart/drop) unchanged.

## src/views/todo.ts
`render()` now groups by Eisenhower quadrant; storage order untouched:
```ts
const GROUP_ORDER: { key: Quadrant | ""; label: string }[] = [
  { key: "q1", label: "Do First" },
  { key: "q2", label: "Schedule" },
  { key: "q3", label: "Delegate" },
  { key: "q4", label: "Eliminate" },
  { key: "", label: "Unsorted" },
];

function render() {
  const list = $("todoList");
  const todos = store.data.todos;
  list.innerHTML = "";
  if (!todos.length) {
    list.innerHTML = `<div class="todo-empty">No tasks yet. ...</div>`;
  } else {
    for (const group of GROUP_ORDER) {
      const items = todos.filter((t) => (t.quadrant || "") === group.key);
      if (!items.length) continue;
      const heading = document.createElement("div");
      heading.className = "todo-group-label" + (group.key ? " " + group.key : "");
      heading.textContent = group.label;
      list.appendChild(heading);
      for (const t of items) list.appendChild(renderItem(t));
    }
  }
  const remaining = todos.filter((t) => !t.done).length;
  $("todoStats").textContent = `${remaining} open · ${todos.length} total`;
}
```
`renderItem`, `addTodos`, `initTodo` unchanged.

## src/style.css  (additions only)
```css
.bd-screen { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
#bd-screen-dump { align-items: center; justify-content: center; overflow-y: auto; padding: 32px 24px; }
.dump-card { width: 100%; max-width: 640px; display: flex; flex-direction: column; gap: 14px; }
.dump-card .dump-textarea { min-height: 300px; font-size: 15px; }
.bd-back-row { padding: 16px 20px 0; }
.bd-back { background: none; border: none; color: var(--ink-mid); cursor: pointer; font-family: 'DM Sans', sans-serif; font-size: 12px; padding: 4px 0; transition: color 0.12s; }
.bd-back:hover { color: var(--ink); }

.todo-group-label { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-mid); font-weight: 500; margin-top: 10px; padding-left: 2px; border-left: 3px solid var(--border-strong); padding-left: 8px; }
.todo-group-label:first-child { margin-top: 0; }
.todo-group-label.q1 { border-left-color: var(--q1-b); color: var(--q1-t); }
.todo-group-label.q2 { border-left-color: var(--q2-b); color: var(--q2-t); }
.todo-group-label.q3 { border-left-color: var(--q3-b); color: var(--q3-t); }
.todo-group-label.q4 { border-left-color: var(--q4-b); color: var(--q4-t); }
```
