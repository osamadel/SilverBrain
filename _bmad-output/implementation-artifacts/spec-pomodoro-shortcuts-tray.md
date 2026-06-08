---
title: 'Pomodoro shortcuts, auto-start breaks, macOS menu-bar timer'
type: 'feature'
created: '2026-06-08'
status: 'done'
context: []
baseline_commit: 'c14ba893eb50cd3414dba4db1a1ea5f64e976148'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Pomodoro timer lacks standard keyboard controls (start/pause, skip session), the skip button is unwired, breaks only switch mode after completion without optional auto-start, and there is no macOS menu-bar presence while a session runs — users must keep the main window visible to track time.

**Approach:** Add Focus-page shortcuts (Space toggle, Cmd/Ctrl+Shift+→ skip, Cmd/Ctrl+Shift+R full reset), wire the existing skip control, add two persisted toggles in Settings → Pomodoro for auto-starting short/long breaks, and integrate a Tauri tray + compact popover window (macOS only) that mirrors timer state, mode tabs, and the active task name. When a **focus** session starts on macOS, hide the main app window so the menu-bar timer is the primary UI; restore the main window via a tray menu action or when the user fully resets the timer to idle.

## Boundaries & Constraints

**Always:** Reuse existing `store.data.pomodoro` persistence and `i18n` `t()` (EN+AR pairs for new strings). Use `e.metaKey || e.ctrlKey` for modified shortcuts. Suppress Pomodoro shortcuts while any `.modal-backdrop` is open or the user is typing in an input/textarea. Main window remains the single source of truth for timer state; tray popover listens to Tauri events and sends commands back. On macOS, starting a **focus** timer hides the main window; breaks and auto-started breaks keep it hidden. Match existing help-panel pattern for documenting new shortcuts.

**Ask First:** Supporting menu-bar tray on Windows/Linux (this spec targets macOS only).

**Never:** No new npm dependencies beyond official Tauri plugins (`tauri-plugin-positioner`). Do not duplicate timer logic in the popover — sync via events/commands. Do not change Pomodoro duration defaults or the focus-session counting rules.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start/pause shortcut | Focus page, no modal, not typing | Space toggles running ↔ paused | Ignored elsewhere |
| Skip shortcut | Focus page, any mode | Advances like session end: focus→break (per interval), break→focus; resets remaining to full duration | Ignored elsewhere |
| Full reset shortcut | Focus page, any mode/state | Stop timer; switch to focus mode; set remaining to focus duration; set `focusSessions` to 0 and persist; clear tray on macOS; show main window if hidden | Ignored elsewhere |
| Soft reset button | Focus page, reset icon clicked | Stop timer; reset remaining for **current** mode only (existing behavior); does **not** clear session count | N/A |
| Auto-start short break ON | Focus timer hits 0, interval says short break | `setMode("short")` then `start()` automatically | OFF → current behavior (mode switch only) |
| Auto-start long break ON | Focus timer hits 0, interval says long break | `setMode("long")` then `start()` automatically | OFF → current behavior |
| Focus session starts (macOS) | `mode === "focus"` and user presses Start / Space | Main window `hide()`; tray icon appears with `MM:SS` title updating each tick | No-op on web/`pnpm dev` browser preview |
| Break session starts (macOS) | `mode === "short"` or `"long"` | Main window stays hidden if already hidden; tray title updates for break countdown | N/A |
| Timer pauses (macOS) | `running === false`, tray active | Tray title freezes at current remaining; main window stays hidden | N/A |
| Timer full reset to idle (macOS) | User presses Cmd/Ctrl+Shift+R or tray “Open App” after full reset | Tray hidden; main window `show()` and `set_focus()` | N/A |
| Tray left-click (macOS) | Tray visible | Toggle compact popover window anchored to tray (`Position::TrayCenter`); shows timer, three mode tabs, task label | Hide on second click |
| Tray menu “Open App” (macOS) | Tray visible | Main window `show()` + `set_focus()`; popover closes if open | N/A |
| Popover mode tab click | Popover open | Sends command to main window; main updates mode + UI + tray | N/A |

</frozen-after-approval>

## Code Map

- `src/views/pomodoro.ts` — timer core; export `toggleTimer`, `skipSession`, `fullReset`; wire skip button; honor `autoStartShort`/`autoStartLong` in `tick()`; emit/listen tray sync events.
- `src/main.ts` — extend `wireGlobalShortcuts` (Space toggle, Cmd/Ctrl+Shift+→ skip, Cmd/Ctrl+Shift+R full reset on Focus page); extend `HELP_GROUPS`; init tray bridge on Tauri/macOS.
- `src/config.ts` — extend `PomodoroSettings` with `autoStartShort: boolean`, `autoStartLong: boolean`; merge defaults in `loadData`.
- `index.html` — add skip button `id="pomoSkipBtn"`; settings toggles in Pomodoro panel; compact `#view-pomodoro-tray` markup (hidden in main, used by popover window) OR dedicated `tray-popover.html`.
- `src/i18n.ts` — keys for auto-start labels, new shortcut descriptions.
- `src/style.css` — popover window compact layout styles.
- `src/tray.ts` (new) — Tauri event bridge: `syncTrayState`, `hideMainWindow`, `showMainWindow`, `initTrayBridge`, platform guard.
- `src-tauri/Cargo.toml` — `tauri` `tray-icon` feature; add `tauri-plugin-positioner` with `tray-icon` feature.
- `src-tauri/tauri.conf.json` — second window `pomodoro-tray` (decorations off, always on top, small size, hidden).
- `src-tauri/src/lib.rs` — tray icon builder, `set_tray_title` / `hide_main_window` / `show_main_window` commands, popover toggle on click, tray menu with “Open App”, positioner setup.
- `src-tauri/capabilities/default.json` — permissions for tray, positioner, extra window.

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` — add `autoStartShort`/`autoStartLong` to `PomodoroSettings` with `false` defaults; persist via existing merge.
- [x] `index.html` — wire skip button id; add two checkbox toggles under Pomodoro settings durations.
- [x] `src/i18n.ts` — add EN+AR strings for auto-start labels and shortcut help rows.
- [x] `src/views/pomodoro.ts` — export `toggleTimer()`/`skipSession()`/`fullReset()`; wire skip btn; auto-start in `tick()`; bind settings toggles; on focus `start()` hide main window (macOS); `fullReset()` clears sessions + tray + shows main window; broadcast state changes for tray.
- [x] `src/main.ts` — Space, Cmd/Ctrl+Shift+→, Cmd/Ctrl+Shift+R handlers on Focus page; update help grid; call `initTrayBridge()`.
- [x] `src/tray.ts` — macOS/Tauri-only bridge using `emit`/`listen` between main and popover windows.
- [x] `src/style.css` — compact tray-popover styles matching existing Pomodoro tokens.
- [x] `src-tauri/*` — tray icon, popover window, positioner plugin, `set_tray_title` command, capabilities.

**Acceptance Criteria:**
- Given the Focus page with no modal open, when I press Space, then the timer toggles between start and pause.
- Given the Focus page, when I press Cmd/Ctrl+Shift+→, then the session advances to the next mode with a full-duration reset (same outcome as clicking skip).
- Given the Focus page with completed sessions or an active break, when I press Cmd/Ctrl+Shift+R, then the timer stops, returns to focus mode at full focus duration, `focusSessions` resets to 0, and the session count UI shows zero.
- Given Settings → Pomodoro with “Auto-start short break” enabled, when a focus session completes on a short-break interval, then the short break begins running automatically.
- Given Settings → Pomodoro with “Auto-start long break” enabled, when a focus session completes on a long-break interval, then the long break begins running automatically.
- Given the macOS Tauri app on the Focus page, when I start a focus session, then the main app window hides and the menu bar shows the remaining time updating each second.
- Given the tray icon visible, when I left-click it, then a compact window appears showing the timer, Focus/Short/Long tabs, and the current task name; clicking again hides it.
- Given the main window is hidden during a session, when I choose “Open App” from the tray menu or press Cmd/Ctrl+Shift+R, then the main window reappears and the tray is cleared.
- Given the help panel, when I open it, then the new Focus shortcuts are listed under the Focus group.

## Verification

**Commands:**
- `pnpm build` — expected: TypeScript + Vite build succeed.
- `pnpm tauri build` or `pnpm tauri dev` — expected: Rust compiles with tray + positioner plugins (macOS).

**Manual checks:**
- On macOS via `pnpm tauri dev`: start focus timer → main window hides, tray shows countdown; click tray → popover shows tabs + task; Cmd+Shift+R full reset restores main window and clears session count; exercise Space, Cmd+Shift+→, Cmd+Shift+R; toggle auto-start settings and complete a focus session.

## Design Notes

Tray popover reuses Pomodoro mode/tab markup in a dedicated small window (`pomodoro-tray` label). Main window emits `pomodoro:state` `{ remaining, running, mode, taskText, focusSessions }` on every tick/render; popover emits `pomodoro:cmd` `{ action: "toggle"|"skip"|"setMode"|"fullReset", mode? }`. Rust holds `TrayIcon` handle; frontend invokes `set_tray_title` each second while session active. On focus `start()`, call `hide_main_window`; tray stays through breaks; `fullReset()` or tray “Open App” calls `show_main_window` and clears tray. **Soft reset** (ring reset button) restarts the current interval only; **full reset** (Cmd/Ctrl+Shift+R) is the day-reset that zeroes `focusSessions`. Tray/popover logic gated to macOS Tauri only (`#[cfg(target_os = "macos")]`).

## Suggested Review Order

**Timer core & session flow**

- Pomodoro state machine, auto-start breaks, tray sync hooks.
  [`pomodoro.ts:71`](../../src/views/pomodoro.ts#L71)

- macOS hide-on-focus-start and full-reset tray teardown.
  [`pomodoro.ts:153`](../../src/views/pomodoro.ts#L153)

**Keyboard shortcuts**

- Global shortcut layer for Space, skip, and full reset.
  [`main.ts:548`](../../src/main.ts#L548)

**Settings & persistence**

- Auto-start break toggles persisted in `PomodoroSettings`.
  [`config.ts:36`](../../src/config.ts#L36)

**macOS tray bridge**

- Frontend invoke/event bridge between main and popover windows.
  [`tray.ts:1`](../../src/tray.ts#L1)

- Compact popover UI entry point.
  [`tray-popover.ts:1`](../../src/tray-popover.ts#L1)

**Tauri native layer**

- Tray icon, window hide/show commands, popover positioning.
  [`lib.rs:37`](../../src-tauri/src/lib.rs#L37)

**Build & config**

- Second Vite entry and Tauri popover window definition.
  [`vite.config.ts:28`](../../vite.config.ts#L28)

