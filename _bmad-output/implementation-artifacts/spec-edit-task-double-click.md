---
title: 'Double-click inline task editing'
type: 'feature'
created: '2026-06-08'
status: 'done'
route: 'one-shot'
context: []
---

# Double-click inline task editing

## Intent

**Problem:** Task text on the Sort and Tasks pages was read-only after creation — the only way to fix a typo or reword a task was to delete and re-add it.

**Approach:** Add a shared inline-edit helper triggered by double-click on task text. Enter or blur commits the trimmed text to `SessionTask.text` and persists; Escape cancels. Sort chips disable drag while editing.

## Suggested Review Order

1. [`src/inline-edit.ts`](../../src/inline-edit.ts) — shared edit lifecycle (dblclick, Enter/blur commit, Escape cancel, single active editor)
2. [`src/views/sort.ts`](../../src/views/sort.ts) — wire on drawer/matrix chips; pause drag during edit
3. [`src/views/todo.ts`](../../src/views/todo.ts) — wire on task row text
4. [`src/style.css`](../../src/style.css) — `.inline-editing` focus outline and text cursor
