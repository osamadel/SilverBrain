---
title: 'Keyboard shortcuts + non-blocking finish + vertical centering'
type: 'feature'
created: '2026-06-05'
status: 'done'
context: []
baseline_commit: '4e11d647aa53b8b77aa9cc51c8cc90295ec3951a'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app lacks modern keyboard shortcuts (only Brain Dump has Cmd/Ctrl+Enter). "Finish Sorting" blocks the UI for several seconds while it learns preferences, feeling like a hang. The Brain Dump and Focus pages render content pinned toward the top, leaving an unbalanced gap.

**Approach:** Add a global keyboard layer (Cmd/Ctrl+Enter context action, Cmd/Ctrl+`,` settings, Cmd/Ctrl+B sidebar, Cmd/Ctrl+Shift+`[`/`]` page nav). Make Finish Sorting navigate to Tasks immediately and learn preferences in the background with a toast indicator. Vertically center the Brain Dump and Focus page content.

## Boundaries & Constraints

**Always:** Reuse the existing `showToast`/`dismissToast` toast system and `i18n` `t()` keys (add EN+AR pairs for new strings). Use `e.metaKey || e.ctrlKey` for the modifier. Brain Dump's existing textarea Cmd/Ctrl+Enter behavior must keep working (extract) with no double-trigger. Shortcuts that change view or run actions must be suppressed while a modal backdrop is open.

**Ask First:** Changing which views exist or their order; altering the learn-preferences LLM logic itself.

**Never:** No new dependencies. No HTML structural rewrites for centering (CSS-only). Do not add shortcuts beyond those listed. Do not wrap page-nav past the ends is NOT forbidden — cycling is allowed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Finish Sorting, provider configured + tasks exist | Cmd/Ctrl+Enter or button on Sort page | Switch to Tasks instantly; "Saving preferences…" info toast; on done → success toast | On failure → existing `status-learn-failed` warning toast |
| Finish Sorting, no provider / no tasks | Same | Switch to Tasks instantly; no learning, no toast | N/A |
| Cmd/Ctrl+Enter on Tasks page | First todo item exists | Send first task to Focus timer, switch to Focus view | If list empty → no-op |
| Cmd/Ctrl+Enter on Tasks page | List empty | No-op | N/A |
| Cmd/Ctrl+Shift+`]` / `[` | Any view | Move to next / previous view (cycles at ends) | N/A |
| Any shortcut while a modal is open | Settings/History/Export open | View-nav + Enter actions suppressed | N/A |

</frozen-after-approval>

## Code Map

- `src/main.ts` -- app shell; holds `currentView`, `switchView`, `openSettings`, sidebar toggle. Add global keydown layer + extract `toggleSidebar`.
- `src/views/sort.ts` -- `finishSorting()` (currently blocks). Make non-blocking; export a `requestFinishSort()` trigger.
- `src/views/todo.ts` -- todo list + `onFocusTask` callback. Export `focusFirstTask()`.
- `src/views/braindump.ts` -- textarea Cmd/Ctrl+Enter handler (leave as-is; verify no double-trigger).
- `src/i18n.ts` -- add `status-learning`, `status-learned` (EN+AR).
- `src/style.css` -- `.bd-page`/`.bd-head`/`.bd-body` (~1784) and `.pomo-wrap`/`#view-pomodoro` (~1504) for vertical centering.

## Tasks & Acceptance

**Execution:**
- [x] `src/i18n.ts` -- reused existing `status-learning-memory` for the loading toast; added `status-learned` ("Preferences saved" / AR) near `status-learn-failed`.
- [x] `src/views/sort.ts` -- rewrote `finishSorting()`: calls `switchToTodo()` first; returns if not (configured && tasks && session); else shows persistent info toast id `learn-prefs`, runs learn/save in background, on success `dismissToast` + success toast, on error `dismissToast` + `status-learn-failed` warning. Imported `dismissToast`. Exported `requestFinishSort()`. Removed button-disable logic.
- [x] `src/views/todo.ts` -- exported `focusFirstTask()` calling `onFocusTask(tasks()[0].text)` when a task exists.
- [x] `src/main.ts` -- extracted module-level `toggleSidebar()`; added `VIEWS` array + `navigateRelative(delta)` (cycling); added `wireGlobalShortcuts()` handling Cmd/Ctrl+`,` (settings), `B` (sidebar), Shift+`BracketLeft`/`BracketRight` via `e.code` (page nav), Enter (Sort→`requestFinishSort`, Tasks→`focusFirstTask`; nav/Enter suppressed when a `.modal-backdrop` is visible); called from `main()`. Imported `requestFinishSort`, `focusFirstTask`.
- [x] `src/style.css` -- Brain Dump: `.bd-page` `justify-content:center` + vertical padding; `.bd-head` dropped `--page-head-space` top pad; `.bd-body` `flex:1` → `flex:0 1 auto`. Focus: `#view-pomodoro` centered flex column; `.pomo-wrap` dropped `--page-head-space` top push.

**Acceptance Criteria:**
- Given the Sort page with a configured provider and tasks, when I press Cmd/Ctrl+Enter, then the app switches to Tasks immediately and a background "Saving preferences…" toast appears, resolving to a success toast.
- Given any non-modal view, when I press Cmd/Ctrl+Shift+`]`, then the next view in order (braindump→sort→todo→pomodoro, cycling) becomes active; `[` goes the other way.
- Given any view, when I press Cmd/Ctrl+`,`, settings open; Cmd/Ctrl+B toggles the sidebar and the collapse state persists.
- Given the Brain Dump and Focus pages on a normal desktop window, when rendered, then the header+content group and the timer respectively appear vertically centered rather than top-pinned.
- Given the Brain Dump textarea focused, when I press Cmd/Ctrl+Enter, then extraction runs exactly once (no double trigger from the global layer).

## Verification

**Commands:**
- `pnpm build` -- expected: `tsc` type-check + vite build succeed with no errors.

**Manual checks:**
- In `pnpm dev` browser preview: exercise each shortcut; confirm Finish Sorting no longer blocks; confirm Brain Dump and Focus content is vertically centered (screenshot).

## Suggested Review Order

**Global keyboard layer (entry point)**

- Single document-level handler dispatching every shortcut; start here for design intent.
  [`main.ts:346`](../../src/main.ts#L346)
- View cycling with wrap-around; drives Cmd+Shift+[ / ].
  [`main.ts:60`](../../src/main.ts#L60)
- Sidebar toggle hoisted to module scope so the shortcut and buttons share it.
  [`main.ts:39`](../../src/main.ts#L39)

**Non-blocking Finish Sorting**

- Navigates first, then learns preferences in the background behind a toast.
  [`sort.ts:152`](../../src/views/sort.ts#L152)
- Keyboard entry point wrapping the async finish.
  [`sort.ts:196`](../../src/views/sort.ts#L196)
- First-task focus action invoked by Cmd+Enter on the Tasks page (stored order).
  [`todo.ts:115`](../../src/views/todo.ts#L115)

**Supporting**

- New success-toast string (EN+AR); loading reuses existing `status-learning-memory`.
  [`i18n.ts:77`](../../src/i18n.ts#L77)
- Brain Dump vertical centering (header+box as a group).
  [`style.css:1790`](../../src/style.css#L1790)
- Focus page vertical centering.
  [`style.css:1504`](../../src/style.css#L1504)
