---
title: 'App restructure: page-nav, settings overhaul, unified brain-dump sessions & history'
type: 'feature'
created: '2026-06-05'
status: 'done'
context: []
baseline_commit: '391a4e0'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** SilverBrain forces a linear wizard (dump → sort) inside one view with a step-progress widget, a cluttered navbar (theme toggle + provider-label settings button), an inline bottom markdown panel, a hardcoded extraction prompt, and a flat single-state data model. There is no concept of past brain dumps, and manually-created tasks live in a store disconnected from the sorting matrix.

**Approach:** Convert the app into four navigable pages (Brain Dump, Sort, Tasks, Focus) reachable from the navbar; clean the navbar to logo + tabs + a single gear icon that opens Settings. Move the theme toggle into Settings and add a Task-Extraction section there for viewing/editing/resetting the prompt. Introduce a `BrainDumpSession` as the single source of truth: each session owns its dump plus a unified task list (each task carries an optional quadrant + done-state). Cmd/Ctrl+Enter or the Extract button runs extraction, creates a new session with an LLM-generated title/summary, and auto-navigates to the Sort page where unsorted tasks live in a left drawer and assigned tasks appear in their quadrant. A history dialog lists past sessions for retrieval; Export opens a markdown dialog.

## Boundaries & Constraints

**Always:**
- Keep the existing dark-canvas design system: CSS custom properties in `src/style.css`, surface ladder, hairline borders, lavender-blue primary, Material Symbols icons. Match the minimal aesthetic of `stitch/1._brain_dump_minimal/screen.png` (Brain Dump) and `stitch/2._sort_minimal/screen.png` (Sort).
- Keep all user-facing strings going through `src/i18n.ts` (`data-i18n` / `t()`), with both `en` and `ar` entries for every new key.
- Persist all state through `store.persistData()` / `store.persistSettings()`; never write files directly from views.
- Preserve element-ID binding discipline: views look up elements by `id`. Reuse existing IDs where the element survives; add new IDs for new elements.
- Migrate any pre-existing `data.json` (legacy `dump`/`tasks`/`matrix`/`todos`) into one initial session on load so existing users lose nothing.

**Ask First:**
- Deleting or renaming a persisted settings/data field in a way that would silently drop existing user data without migration.

**Never:**
- Do not introduce a new framework, router library, or CSS framework (no Tailwind in the production build). Plain TS + existing patterns only.
- Do not move network calls out of the Tauri HTTP-proxied `fetch` in `src/llm.ts`.
- Do not break the Pomodoro view contract (`setActiveTask`, `refreshPomodoroI18n`, `initPomodoro`).
- Out of scope: per-task editing of text after creation beyond what exists, cloud sync, multi-device, auth.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Extract success | Non-empty dump, provider configured | New session created (LLM title+summary+tasks), set active, tasks added with quadrant `""`, auto-navigate to Sort page, drawer shows tasks | n/a |
| Extract, no provider | Dump typed, no provider configured | Open Settings; do not create a session | Show no-provider notice |
| Extract, empty dump | Blank textarea, Cmd+Enter | No-op with "write something first" status | n/a |
| LLM title fails but tasks ok | Provider returns tasks, meta call errors | Session still created; title = first line of dump, summary = first 100 chars | Swallow meta error, log to console |
| Manual task add (Sort drawer / Tasks page) | No active session exists | Lazily create an empty session, set active, add task | n/a |
| Add task with quadrant | Task added with quadrant `q2` on Tasks page | Appears in q2 box on Sort page, not in drawer | n/a |
| Add task without quadrant | Task added with no quadrant | Appears in Sort drawer (unsorted), not in any box | n/a |
| Drag task drawer→quadrant / quadrant→quadrant | Drag a session task | Task's `quadrant` updated, persisted, both Sort + Tasks views reflect it | n/a |
| Open history, select session | Click a past session row | That session becomes active; dump + tasks + matrix restored; navigate to Sort | n/a |
| Export with placed tasks | Sort page, ≥1 task in a quadrant | Modal dialog opens with generated markdown + Copy button | n/a |
| Migration on first load | Legacy `data.json` with tasks/matrix/todos, no `sessions` | One session synthesized from legacy fields, set active; legacy fields ignored thereafter | If parse fails, start with empty sessions |

</frozen-after-approval>

## Code Map

- `src/config.ts` -- data types + persistence. Add `SessionTask`, `BrainDumpSession`; replace flat `dump/tasks/matrix/todos` in `AppData` with `sessions[]` + `activeSessionId`; add `extractionPrompt?` to `AppSettings`; add legacy-migration in `loadData`.
- `src/store.ts` -- add `activeSession()` getter and `ensureActiveSession()` / `createSession()` helpers operating on `data.sessions`.
- `src/llm.ts` -- export `DEFAULT_EXTRACTION_PROMPT`; make `extractTasks` use `settings.extractionPrompt` when set; add `generateSessionMeta(settings, dump)` → `{title, summary}` (separate small call, parallel with extraction).
- `index.html` -- restructure: navbar (logo + 4 tabs + gear only); new top-level `view-sort`; minimal `view-braindump`; Settings modal gains Appearance + Task-Extraction sections; add History dialog + Export dialog modals; remove step-progress widget, inline output-section, themeToggleBtn, provider-label settings button.
- `src/main.ts` -- 4-view `switchView`; gear opens settings; move theme toggle into settings; wire Appearance + extraction-prompt controls (save/reset); wire history + export dialogs; orchestrate extract→navigate-to-Sort.
- `src/views/braindump.ts` -- split into the minimal dump page (textarea, extract, Cmd/Ctrl+Enter, history button) and remove the embedded sort/matrix/output logic.
- `src/views/sort.ts` (new) -- Sort page: left drawer (unsorted session tasks + add-task input), 2×2 Eisenhower matrix, drag-and-drop, bottom bar (Back, Export, Finish Sorting), markdown generation feeding the Export dialog.
- `src/views/todo.ts` -- refactor to read/write the active session's `tasks` (keep done-state, quadrant badge, focus button, grouping); "Send to Tasks" no longer needed.
- `src/i18n.ts` -- add keys for new sections, Sort page, history dialog, export dialog, appearance/theme, extraction-prompt; remove now-dead step/`send-todo` keys only if unused.

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` -- Define `SessionTask {id,text,quadrant:Quadrant|"",done}` and `BrainDumpSession {id,title,summary,createdAt,dump,tasks:SessionTask[]}`. Change `AppData` to `{sessions:BrainDumpSession[]; activeSessionId:string|null; pomodoro; focusSessions}`. Add `extractionPrompt?:string` to `AppSettings`. In `loadData`, detect legacy shape (presence of `dump`/`tasks`/`matrix`/`todos`) and synthesize one session (tasks from matrix carry their quadrant; bare `tasks` + legacy `todos` map to `SessionTask`s; title/summary heuristic) when `sessions` absent. Update `DEFAULT_DATA`.
- [x] `src/store.ts` -- Add `activeSession(): BrainDumpSession | null`, `createSession(fields): BrainDumpSession` (uid, createdAt, sets active), `ensureActiveSession(): BrainDumpSession`. Keep debounced persistence.
- [x] `src/llm.ts` -- Export `DEFAULT_EXTRACTION_PROMPT`; `extractTasks` uses `settings.extractionPrompt?.trim() || DEFAULT_EXTRACTION_PROMPT`. Add `generateSessionMeta` (one small call returning `{title,summary}`; robust JSON parse).
- [x] `index.html` -- Navbar: logo + tabs (Brain Dump, Sort, Tasks, Focus) + single `#settingsBtn` gear icon (remove `#themeToggleBtn` and provider-label). Minimal `#view-braindump` (textarea `#dumpInput`, `#extractBtn`, info `(i)`, `#historyBtn`); remove `.step-progress`. New `#view-sort` with `.sort-drawer` (handle + unsorted list `#sortDrawerList` + add-task input) and the 2×2 matrix (`#q1..#q4`, drag hints), bottom bar (`#sortBackBtn`, `#exportBtn`, `#finishSortBtn`). Settings modal: add Appearance section (theme toggle `#themeSelect`/buttons) and Task-Extraction section (`#promptTextarea`, `#promptResetBtn`). Add `#historyModal` and `#exportModal` (markdown `#exportMd`, `#exportCopyBtn`). Remove inline `#outputSection`.
- [x] `src/views/sort.ts` -- New module `initSort({openExportDialog})`: render drawer from active session tasks where `quadrant===""`; render quadrants from assigned tasks; drag-and-drop updates `task.quadrant` + persists; add-task input creates an unsorted `SessionTask` (via `ensureActiveSession`); drawer open/close via handle; `generateMarkdown()` builds the export string from the active session matrix; Finish Sorting → Tasks page; Back → Brain Dump.
- [x] `src/views/braindump.ts` -- Reduce to dump page: restore/persist `activeSession().dump` (or empty), `runExtract()` (calls `extractTasks`+`generateSessionMeta` in parallel, creates session, navigates to Sort), Cmd/Ctrl+Enter handler, no-provider notice, history button opens history dialog. Remove matrix/drawer/output code (moved to sort.ts).
- [x] `src/views/todo.ts` -- Operate on `store.activeSession()?.tasks ?? []` instead of `data.todos`. Keep quadrant grouping, done-toggle, focus button, delete, clear-completed, stats. Add-task form pushes a `SessionTask` to the active session (`ensureActiveSession`).
- [x] `src/main.ts` -- `View = 'braindump'|'sort'|'todo'|'pomodoro'`; tab + programmatic navigation across 4 views. Gear → `openSettings`. Move theme load/toggle into settings (`#themeSelect`), keep `localStorage 'sb-theme'`. Wire prompt save/reset (persist `settings.extractionPrompt`, reset clears to default). Build & wire history dialog (list sessions newest-first: title, localized date, first 100 chars; click → set active, refresh views, navigate to Sort) and export dialog (open with markdown, copy-to-clipboard). Provide `openExportDialog`/`switchView` to sort.ts; provide history opener to braindump.ts.
- [x] `src/i18n.ts` -- Add en+ar keys: section-appearance, label-theme, theme-light/dark, section-prompt, label-prompt, btn-reset-prompt, sort page (drawer title, add-task placeholder, finish-sorting, back), history (title, empty, relative/date), export dialog (title, copy, copied). Drop unused step/send-todo keys.

**Acceptance Criteria:**
- Given the app opens with no sessions, when it loads, then the Brain Dump page shows centered minimal input matching `stitch/1._brain_dump_minimal/screen.png`, and the navbar shows logo + 4 tabs + a gear icon only (no theme toggle, no provider label).
- Given a configured provider and typed dump, when the user presses Cmd/Ctrl+Enter, then extraction runs, a new titled session is created, and the app auto-navigates to the Sort page with the tasks in the left drawer (drawer matching `stitch/2._sort_minimal/screen.png`).
- Given the user clicks the gear icon, when Settings opens, then it includes a theme toggle and a Task-Extraction section where the prompt can be viewed, edited, saved, and reset to default; saving persists and subsequent extractions use the edited prompt.
- Given a task is created on the Tasks page with quadrant q1, when the user opens the Sort page, then it appears in the Do-First box and not in the drawer; with no quadrant it appears in the drawer.
- Given multiple past sessions exist, when the user clicks the history icon and selects one, then its dump, tasks, and quadrant placements are restored as the active session.
- Given ≥1 task placed in the matrix, when the user clicks Export, then a modal dialog opens with the markdown and a working Copy button (no bottom slide-in panel).
- Given a pre-existing legacy `data.json`, when the app loads, then its tasks/matrix/todos appear inside one migrated session with no data loss.

## Design Notes

Unified task identity: drag-and-drop and the Tasks/Sort/Export views all key off `SessionTask.id`; quadrant boxes filter `tasks` by `quadrant===q`, the drawer filters by `quadrant===""`. Re-extraction creates a *new* session (history accumulates) rather than mutating the current one.

`generateSessionMeta` shape (separate, non-user-editable call), with heuristic fallback on any error:
```
{"title": "≤6 words, no quotes", "summary": "≤140 chars, one sentence"}
```
Sort drawer is collapsible and starts collapsed on the Sort page, opened via a left-edge handle (the ">" affordance in the mockup).

## Verification

**Commands:**
- `npm run build` -- expected: `tsc` passes with no type errors and `vite build` completes (proves the data-model + view refactor type-checks end-to-end).

**Manual checks (browser preview / `npm run dev` on port 1420):**
- Navbar shows logo + 4 tabs + gear only; gear opens Settings with Appearance + Task-Extraction sections.
- Brain Dump → Cmd/Ctrl+Enter extracts and lands on Sort with drawer tasks; drag into a quadrant updates the Tasks page grouping.
- History icon lists sessions and restores a selected one; Export opens a modal with copyable markdown.

## Suggested Review Order

**Data model (start here)**

- Entry point: the unified session/task types everything else builds on.
  [`config.ts:45`](../../src/config.ts#L45)
- Legacy `data.json` → single session; the migration that prevents data loss.
  [`config.ts:158`](../../src/config.ts#L158)
- Load branch deciding migrate vs. session-shape merge.
  [`config.ts:197`](../../src/config.ts#L197)
- Active-session getter + lazy `ensureActiveSession` (single source of truth).
  [`store.ts:25`](../../src/store.ts#L25)

**Extraction + session meta**

- Editable prompt default + custom-prompt resolution with `{dump}` fallback.
  [`llm.ts:110`](../../src/llm.ts#L110)
- Separate best-effort title/summary call (heuristic fallback in caller).
  [`llm.ts:165`](../../src/llm.ts#L165)
- Extract → reuse-or-create session → navigate to Sort; Cmd/Ctrl+Enter wired in init.
  [`braindump.ts:27`](../../src/views/braindump.ts#L27)

**Sort page (drawer + matrix)**

- Quadrant assignment is the one mutation; drawer = `quadrant===""`, boxes = `q`.
  [`sort.ts:29`](../../src/views/sort.ts#L29)
- DnD wiring, drawer add-task, export/finish/back handoffs.
  [`sort.ts:150`](../../src/views/sort.ts#L150)
- Markdown built from the active session for the export dialog.
  [`sort.ts:126`](../../src/views/sort.ts#L126)
- Tasks page now reads the active session (kept done-state, focus, grouping).
  [`todo.ts:22`](../../src/views/todo.ts#L22)

**Orchestration (nav, theme, settings, dialogs)**

- 4-view nav; re-renders Sort/Tasks on enter; index-based direction.
  [`main.ts:22`](../../src/main.ts#L22)
- Theme moved into Settings → Appearance, applies live + persists.
  [`main.ts:67`](../../src/main.ts#L67)
- Save persists custom prompt only when it differs from default.
  [`main.ts:158`](../../src/main.ts#L158)
- History dialog: list newest-first, restore session on click.
  [`main.ts:220`](../../src/main.ts#L220)
- Export modal open + copy-to-clipboard.
  [`main.ts:271`](../../src/main.ts#L271)

**Markup & styles (supporting)**

- Clean navbar (logo + 4 tabs + gear), Sort view, history/export dialogs, settings sections.
  [`index.html:349`](../../index.html#L349)
- Sort page, off-canvas drawer, dialogs, segmented theme control, prompt textarea.
  [`style.css:1610`](../../src/style.css#L1610)
