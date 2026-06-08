---
title: 'Sort checkboxes and Tasks quadrant picker'
type: 'feature'
created: '2026-06-08'
status: 'done'
route: 'one-shot'
context: []
---

# Sort checkboxes and Tasks quadrant picker

## Intent

**Problem:** On the Sort page, tasks could not be marked complete inline; completion state from the Tasks page was not reflected visually on Sort. On the Tasks page, quadrant badges were read-only after assignment.

**Approach:** Add checkboxes to Sort drawer and matrix chips that toggle the shared `SessionTask.done` field. Style completed tasks with strikethrough on Sort. Make Tasks quadrant badges open a small picker menu to reassign `quadrant`.

## Suggested Review Order

1. [`src/views/sort.ts`](../../src/views/sort.ts) — checkbox toggle + done styling hook
2. [`src/views/todo.ts`](../../src/views/todo.ts) — quadrant picker menu on badge click
3. [`src/style.css`](../../src/style.css) — `.sort-check`, `.quadrant-picker`, done strikethrough
4. [`src/i18n.ts`](../../src/i18n.ts) — `sort-toggle-done`, `todo-change-quadrant`
