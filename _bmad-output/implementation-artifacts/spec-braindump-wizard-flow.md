---
title: 'Brain Dump → Sort wizard, working DnD, grouped Todo migration'
type: 'feature'
created: '2026-06-04'
status: 'done'
context: []
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Brain Dump tab crowds the dump textarea and the Eisenhower matrix onto one screen, so capture isn't focused; the matrix drag-and-drop silently fails (the Tauri window's native drag handler swallows HTML5 drag events); and "Send to Todo" produces a flat list that ignores quadrant priority.

**Approach:** Split the Brain Dump tab into a two-screen wizard — a focused dump screen, then a sort screen (task list + matrix) shown after "Extract tasks". Disable the window's native drag handler so HTML5 DnD works. Render the Todo list grouped under Eisenhower quadrant headings (Do First / Schedule / Delegate / Eliminate, then Unsorted) in the same order as the markdown export. Pomodoro keeps its existing manual ▶-to-focus flow.

## Boundaries & Constraints

**Always:** Persist all state through `store.data` exactly as today (dump, tasks, matrix, todos survive restart). Keep the existing visual language (fonts, colors, quadrant palette, step indicator). Preserve the markdown export and "Send to Todo" button. Reuse existing CSS classes/vars where they fit.

**Ask First:** Any change to the `AppData` shape in `config.ts`, or removing/renaming the top-level tabs.

**Never:** Do not auto-migrate tasks to Todo (migration stays button-triggered). Do not turn Pomodoro into an auto-advancing queue. Do not add new dependencies. Do not change the LLM extraction logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Extract succeeds | Dump text, provider configured | Tasks stored; wizard advances to sort screen; step 2 active | n/a |
| Reopen app with tasks present | `store.data.tasks` non-empty | Brain Dump opens directly on the sort screen | n/a |
| Reopen app, no tasks | `store.data.tasks` empty | Brain Dump opens on the dump screen | n/a |
| Back from sort screen | On sort screen | Returns to dump screen; dump text intact; tasks/matrix unchanged | n/a |
| Drag list task → quadrant | Task dragged onto a quadrant | Task lands in quadrant, leaves the list (DnD physically works) | Drop outside any quadrant: no change |
| Send to Todo | Tasks placed across quadrants | Todo list shows them grouped under quadrant headings in q1→q4 order | Empty matrix: button disabled |
| Manual Todo add, no quadrant | "No quadrant" selected | Item appears under an "Unsorted" group | n/a |
| Reset everything | On sort screen | Clears tasks/matrix/dump and returns to dump screen | n/a |

</frozen-after-approval>

## Code Map

- `src-tauri/tauri.conf.json` -- window config; add `dragDropEnabled: false` to re-enable webview HTML5 DnD (root cause of broken matrix drag).
- `index.html` -- `#view-braindump` markup; split into `#bd-screen-dump` and `#bd-screen-sort`, add a Back control.
- `src/views/braindump.ts` -- wizard screen switching, init-time screen selection, reset returns to dump screen. DnD code itself is correct and unchanged.
- `src/views/todo.ts` -- `render()` rewritten to group items by quadrant under headings; ordering q1→q4 then unsorted.
- `src/style.css` -- styles for the two wizard screens (centered dump screen) and Todo group headings.
- `src/views/pomodoro.ts` / `src/main.ts` -- no logic change; verify the ▶ focus → Pomodoro path still works after restructure.

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/tauri.conf.json` -- add `"dragDropEnabled": false` to the single window object -- lets the webview receive HTML5 drag events so the matrix DnD works.
- [x] `index.html` -- wrap the dump `.section` in `#bd-screen-dump` (focused, centered) and the `.main` + `.bottom-bar` + `.output-section` in `#bd-screen-sort` (hidden by default); move the `.tasks-section` into the sort screen's left column; add a "← Edit dump" back button on the sort screen -- realizes the two-screen wizard.
- [x] `src/views/braindump.ts` -- add `showDumpScreen()`/`showSortScreen()` toggling the two containers + step indicator; advance to sort screen on successful extract; wire Back button to dump screen; on init show sort screen iff `store.data.tasks.length`; `resetAll()` returns to dump screen -- drives wizard navigation.
- [x] `src/views/todo.ts` -- rewrite `render()` to bucket todos into q1,q2,q3,q4 then unsorted, rendering a small heading per non-empty group (labels: Do First / Schedule / Delegate / Eliminate / Unsorted) with items under each; keep item rendering, focus ▶, delete, check, and stats intact -- grouped migration view.
- [x] `src/style.css` -- add `.bd-screen` centering for the dump screen, `.bd-back` button style, and `.todo-group-label` heading style; keep existing classes -- visual support.

**Acceptance Criteria:**
- Given a configured provider and dump text, when I click "Extract tasks", then the view advances to the sort screen showing the extracted task list and the matrix, with step 2 marked active.
- Given I am on the sort screen, when I drag a task from the list onto a quadrant, then it visibly moves into that quadrant and is removed from the list (drag-and-drop functions).
- Given tasks are placed in multiple quadrants, when I click "Send to Todo", then the Todo tab lists them under quadrant headings ordered Do First → Schedule → Delegate → Eliminate (Unsorted last).
- Given a Todo item, when I click its ▶ button, then the Pomodoro tab opens with that task set as the active focus task.
- Given I reopen the app with previously extracted tasks, when the Brain Dump tab loads, then it opens on the sort screen; with no tasks it opens on the dump screen.

## Design Notes

Quadrant order and labels must match `generateMarkdown()` in `braindump.ts` (q1 Do First, q2 Schedule, q3 Delegate, q4 Eliminate) so the Todo grouping mirrors the Obsidian markdown. Todo grouping is a pure render-time reorder over `store.data.todos`; do not mutate stored order. Screen toggling uses the existing `.hidden` class. The existing `updateSteps(n)` already styles the step indicator — reuse it.

## Verification

**Commands:**
- `pnpm build` -- expected: `tsc` typechecks clean and `vite build` succeeds with no errors.

**Manual checks:**
- `pnpm tauri dev`: dump screen is focused/centered; Extract advances to sort screen; dragging a list task into a quadrant works and persists; Back returns to dump with text intact; Send to Todo shows grouped headings in q1→q4 order; ▶ on a Todo item loads it into Pomodoro; relaunch reopens on the correct screen.

## Suggested Review Order

**The DnD fix (root cause)**

- Tauri's native drag handler was swallowing HTML5 DnD; disabling it is the whole fix.
  [`tauri.conf.json:20`](../../src-tauri/tauri.conf.json#L20)

**Wizard structure & navigation**

- Markup split into two sibling screens — start here to see the new shape.
  [`index.html:77`](../../index.html#L77)
- Sort screen + its back-button row (was crammed onto the dump screen before).
  [`index.html:98`](../../index.html#L98)
- The two-screen toggle — the design's core mechanism.
  [`braindump.ts:31`](../../src/views/braindump.ts#L31)
- Initial screen chosen from persisted task state on load.
  [`braindump.ts:309`](../../src/views/braindump.ts#L309)
- Back button wiring returns to the focused dump.
  [`braindump.ts:286`](../../src/views/braindump.ts#L286)

**Re-extract safety (review fix)**

- Re-extraction clears stale matrix/export and guards the zero-task case.
  [`braindump.ts:68`](../../src/views/braindump.ts#L68)

**Grouped Todo migration**

- Quadrant order mirrors the markdown export.
  [`todo.ts:25`](../../src/views/todo.ts#L25)
- Render-time grouping; storage order untouched; `tg-` class avoids matrix CSS collision.
  [`todo.ts:42`](../../src/views/todo.ts#L42)

**Styling (supporting)**

- Centered dump screen + scoped group-heading styles.
  [`style.css:53`](../../src/style.css#L53)
