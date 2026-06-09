---
title: 'Past brain dumps — per-row load & import actions'
type: 'feature'
created: '2026-06-09'
status: 'done'
baseline_commit: '9d8f8d8019901f97c9ecffd9efe5a4ab3658df09'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Brain Dump History dialog lets you click a row to *load* a past dump (replacing the active session), but there's no way to *import* a past dump's tasks into the session you're already working in, and there are no explicit, discoverable per-row action affordances or keyboard shortcuts for these actions.

**Approach:** Give every history row two circular icon buttons on its trailing edge — **Load** (restore that dump as the active session, current behavior) and **Import** (append that dump's tasks into the current/active session) — styled like the `.dump-history-btn` pill on the Brain Dump page. Add keyboard support inside the dialog: **Arrow Up/Down** highlight (move focus between) rows, **Enter** loads the highlighted row's dump (the first/Load action), and **Shift+Enter** imports the highlighted row's tasks.

## Boundaries & Constraints

**Always:**
- Match the existing `.dump-history-btn` visual style (34px circle, surface-2 bg, hairline border, material-symbols icon), icon-only with `title`/`aria-label` for tooltips.
- Preserve existing behavior: clicking a row's body still loads that dump.
- Import deep-copies tasks with fresh `uid()` ids, preserves `text`/`quadrant`/`suggestedQuadrant`, resets `done` to `false`, and appends to the active session (via `store.ensureActiveSession()`).
- Add i18n keys (en + ar) for every new tooltip/toast string; keep `kb-` help-panel entries in sync.
- Keyboard actions operate on the currently highlighted (focused) row; rows are the keyboard navigation unit, moved with Arrow Up/Down.

**Ask First:**
- (none — scope is self-contained)

**Never:**
- Do not change the LLM extraction flow, the session data model in `config.ts`, or the Sort/Tasks rendering logic beyond calling existing refresh functions.
- Do not delete or mutate the source session when importing (import is copy-only).
- Do not add extra tab stops per row for the icon buttons (keyboard nav stays at row granularity).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load via button/Enter | Highlighted/clicked row for session S | `activeSessionId = S`, draft synced, Sort view shown, dialog closed | N/A |
| Import via button | Row for session S, active session T (T ≠ S) | S's tasks deep-copied & appended to T, dialog closed, Tasks view shown, success toast `N tasks imported` | N/A |
| Import with no active session | No active session exists | `ensureActiveSession()` creates one, tasks imported into it | N/A |
| Import the active session into itself | Row S where S is the active session | No-op append; informational toast "already in your current session" | Skip duplication |
| Import via Shift+Enter | Highlighted row for session S | Same as Import button | N/A |
| Arrow Up/Down | Dialog open, a row focused | Focus moves to the previous/next row (clamped at ends) | N/A |
| Empty history | No sessions | Existing empty-state message; no rows, no buttons | N/A |

</frozen-after-approval>

## Code Map

- `index.html` (history dialog, ~line 319) -- `#historyBackdrop` / `#historyList` markup; rows are built in JS.
- `src/main.ts` (`loadSession`, `openHistory`, `wireHistory`, ~lines 354-414) -- row construction & dialog wiring; add row body + action buttons, `importSession()`, and the dialog keydown handler. Needs new imports: `showToast` from `./toast`, `uid` from `./config`.
- `src/store.ts` (`ensureActiveSession`) -- existing helper used as the import target.
- `src/style.css` (`.dump-history-btn` ~1273, `.history-row` ~2606) -- restyle `.history-row` as flex container; add `.history-row-body`, `.history-row-actions`, `.history-action-btn`.
- `src/i18n.ts` (history keys ~159, kb keys ~104) -- add tooltip/toast/help strings (en + ar).

## Tasks & Acceptance

**Execution:**
- [x] `src/main.ts` -- Rebuild `openHistory` row markup: change row from `<button>` to `<div class="history-row" tabindex="0" data-id>`; wrap head/preview/meta in a clickable `.history-row-body` (loads on click); append `.history-row-actions` with two `.history-action-btn`s (Load icon `restore`, Import icon `playlist_add`), each `type=button`, `tabindex=-1`, with i18n `aria-label`/`title`. Button clicks call `loadSession`/`importSession` and `stopPropagation`.
- [x] `src/main.ts` -- Add `importSession(id)`: find source session; if it equals the active session, show info toast and return; else `ensureActiveSession()`, append deep-copied tasks (`uid()`, preserve quadrant/suggestedQuadrant, `done:false`), `persistData()`, refresh draft + Sort + Tasks i18n, hide dialog, `switchView("todo")`, success toast.
- [x] `src/main.ts` -- In `wireHistory`, add a keydown listener on `#historyList`: resolve `closest('.history-row')`; `Enter` without Shift → `loadSession`; `Shift+Enter` → `importSession`; `ArrowUp`/`ArrowDown` → move focus to prev/next row (clamped). In `openHistory`, after un-hiding, focus the active row (else first row). Add `showToast`/`uid` imports.
- [x] `src/style.css` -- Make `.history-row` a flex row (body + actions), keep hover/active styles working; restyle `.history-row-body` as the vertical stack (former row content); add `.history-action-btn` mirroring `.dump-history-btn`; add a focus-visible ring on `.history-row`.
- [x] `src/i18n.ts` -- Add `history-load-btn`, `history-import-btn`, `tasks-imported` ({count}), `task-imported-one`, `history-import-self`, and help-panel `kb-history-load` / `kb-history-import` keys (en + ar). Append two shortcut rows (`↵` → load, `⇧ ↵` → import) to a History help group in `src/main.ts` `HELP_GROUPS`.

**Acceptance Criteria:**
- Given the history dialog is open, when I view any row, then two persistently-visible circular icon buttons (Load, Import) sit on the trailing edge styled like the Brain Dump history pill.
- Given a past dump that has no tasks, when I import it, then nothing is appended, no view switch occurs, and an informational toast says it has no tasks.
- Given the dialog is open, when I press Arrow Up/Down, then the highlight (focus) moves between rows.
- Given a highlighted row, when I press Enter, then that dump loads and the Sort view opens.
- Given a highlighted row and a different active session, when I press Shift+Enter (or click Import), then that dump's tasks are appended to my current session, the Tasks view opens, and a success toast shows the imported count.
- Given I import the active session into itself, when the action runs, then no tasks are duplicated and an informational toast explains it.
- Given Arabic locale, when the dialog renders, then buttons sit on the trailing (inline-end) edge and all tooltips/toasts are localized.

## Spec Change Log

- **Iter 1 (step-04 review):** Acceptance auditor flagged AC1 as PARTIAL — it said buttons "appear on hover" but the implementation (intentionally) shows them always. Resolved by correcting the AC wording to "persistently-visible" rather than hiding the buttons; always-visible is more discoverable and matches the user's literal request ("two buttons on the right of each item"). No code change. Edge-case hunter flagged that importing a zero-task session would emit a misleading "0 tasks imported" toast — fixed with an empty-source guard (`history-import-empty`). All other findings rejected as spec-sanctioned design (tabindex=-1 / row-granularity keyboard, clamped arrow nav, Load→Sort/Import→Tasks) or pre-existing/out-of-scope (focus trap, focus restore). KEEP: copy-only import with fresh ids, self-import guard, div-row + tabindex=-1 action buttons, en+ar coverage, `.dump-history-btn` styling parity.

## Design Notes

Rows change from `<button>` to `<div tabindex="0">` so the action `<button>`s can nest validly. Keyboard stays at row granularity (action buttons are `tabindex=-1`); the dialog's own keydown listener owns Enter/Shift+Enter/Arrows. The global shortcut handler bails while any modal is open, so these keys won't conflict. Shift+Enter is platform-neutral — no Cmd/Ctrl branching needed.

Import row icon `playlist_add`; Load icon `restore` (matches the "restore a past dump" semantics) — both from the already-loaded `material-symbols-outlined` font.

## Verification

**Commands:**
- `npm run build` -- expected: `tsc` + Vite build succeed with no type errors.

**Manual checks:**
- `npm run dev`, open history (Cmd/Ctrl+P): rows show Load + Import buttons; click body loads; Arrow Up/Down move the highlight; Enter on highlighted row loads; Shift+Enter imports into current session and lands on Tasks page with the merged list and a toast.

## Suggested Review Order

**Import behavior (the new core logic)**

- Entry point — the import action: copy-only, self-import + empty-source guards, then append/persist/switch.
  [`main.ts:370`](../../src/main.ts#L370)

**Row construction & affordances**

- Row is now a focusable `<div>` with a clickable body + trailing action buttons (tabindex -1).
  [`main.ts:412`](../../src/main.ts#L412)
- The two pill buttons (Load `restore`, Import `playlist_add`) and their stopPropagation handlers.
  [`main.ts:456`](../../src/main.ts#L456)

**Keyboard model**

- Dialog keydown: Enter→load, Shift+Enter→import, ↑/↓→move highlight (clamped).
  [`main.ts:499`](../../src/main.ts#L499)

**Styling & strings (supporting)**

- Row flex layout + `.history-action-btn` mirroring `.dump-history-btn`; focus-visible ring.
  [`style.css:2606`](../../src/style.css#L2606)
- New en+ar tooltip/toast strings and help-panel keys.
  [`i18n.ts:167`](../../src/i18n.ts#L167)
- History shortcut group in the help panel.
  [`main.ts:572`](../../src/main.ts#L572)
