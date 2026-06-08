---
title: 'Tasks keyboard focus sends highlighted task to Pomodoro'
type: 'feature'
created: '2026-06-08'
status: 'done'
route: 'one-shot'
baseline_commit: 'c89979982627bf0d986990fcb34c958091cbb087'
---

## Title and Intent

# Tasks keyboard focus sends highlighted task to Pomodoro

## Intent

**Problem:** On the Tasks page, Cmd/Ctrl+Enter always sent the first task in stored order to the Pomodoro timer, ignoring the row the user had highlighted with ↑/↓ — breaking the keyboard-first workflow.

**Approach:** Reuse the existing `focusedId` cursor from arrow-key navigation so Cmd/Ctrl+Enter sends the highlighted task to Focus; no-op when nothing is highlighted. Update help text and i18n to match.

## Suggested Review Order

- Keyboard-highlighted task lookup replaces first-task shortcut.
  [`todo.ts:223`](../../src/views/todo.ts#L223)

- Global shortcut dispatches to highlighted task on Tasks page.
  [`main.ts:651`](../../src/main.ts#L651)

- Help panel row describes highlighted-task action.
  [`main.ts:441`](../../src/main.ts#L441)

- EN/AR label for the updated shortcut description.
  [`i18n.ts:93`](../../src/i18n.ts#L93)
