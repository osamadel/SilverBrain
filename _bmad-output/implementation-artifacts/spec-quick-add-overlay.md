---
title: 'Global double-Ctrl quick-add overlay'
type: 'feature'
created: '2026-06-08'
status: 'done'
context: []
baseline_commit: 'c14ba893eb50cd3414dba4db1a1ea5f64e976148'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Adding a task requires opening the main app and navigating to the Tasks page. There is no system-wide, Spotlight-style capture flow for jotting a task with its Eisenhower quadrant while another app has focus.

**Approach:** Register a macOS system-level double-tap Control shortcut that toggles a minimal always-on-top overlay: a single text field plus quadrant chips. Submitting adds the task to the active session (same data as the Tasks page) and dismisses the overlay; Esc or a second double-Ctrl dismisses without saving.

## Boundaries & Constraints

**Always:** Reuse existing `store.ensureActiveSession()` / `persistData()` task shape (`SessionTask` with `quadrant: Quadrant`). Reuse `i18n` `t()` keys for quadrant labels (`todo-opt-q1`…`q4`) and add EN+AR strings only for overlay-specific copy. Match existing visual tokens (`--q1-color`…`--q4-color`, surface/radius). Overlay is a dedicated Tauri window (like `pomodoro-tray`), not an in-app modal. After a successful add, notify the main window so the Tasks list re-renders if open. macOS Tauri builds only for the global hotkey — no-op in browser/`pnpm dev` preview.

**Ask First:** Extending double-Ctrl to Windows/Linux; making the shortcut user-configurable in Settings.

**Never:** No new npm dependencies. Do not use `tauri-plugin-global-shortcut` alone for double-tap Ctrl (it cannot detect bare modifier double-taps). Do not call LLM APIs from the overlay. Do not auto-open the main window on submit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Double-Ctrl detected | App running (macOS Tauri), overlay hidden | Show centered overlay on active display; focus task input; pre-select default quadrant `q2` | If Input Monitoring denied, log once; shortcut inert |
| Double-Ctrl while overlay open | Overlay visible | Hide overlay without saving | N/A |
| Submit valid task | Non-empty text + quadrant chip selected, Enter or Add click | Push task to active session, `persistData()`, emit refresh to main, hide overlay | Empty text → no-op, stay open |
| Dismiss | Esc, backdrop click, or close affordance | Hide overlay, no task created | N/A |
| Main window hidden (tray mode) | User adds via overlay | Task persisted to `data.json`; main re-renders when shown | N/A |
| No active session | First quick-add | `ensureActiveSession()` creates "Quick tasks" session | N/A |
| Chip keyboard | Overlay open, chips focused | ←/→ or 1–4 keys move selection; Enter submits | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/src/lib.rs` — CGEventTap (reuse `objc2` stack) for Control keyDown double-tap detection (~350 ms window); `toggle_quick_add_overlay` command; show/hide/position `quick-add` window centered on primary display.
- `src-tauri/Cargo.toml` — no new crates if `objc2` event APIs suffice; otherwise minimal `core-graphics` FFI for event tap.
- `src-tauri/tauri.conf.json` — second overlay window `quick-add` (`quick-add.html`, fullscreen transparent, `alwaysOnTop`, `decorations: false`, `skipTaskbar: true`, `visible: false`).
- `src-tauri/capabilities/` — new `quick-add.json` capability (fs read/write for data, events) + default permissions for main to listen for `quick-add:task-added`.
- `quick-add.html` — minimal shell (input + chip row + submit), loads shared `style.css`.
- `src/quick-add.ts` (new) — overlay logic: init store, chip UI, submit/dismiss, emit `quick-add:task-added`.
- `src/quick-add-bridge.ts` (new) — main-window listener to call `render()` on todo view after add.
- `src/style.css` — `.quick-add-overlay`, `.quick-add-panel`, `.quick-add-chip` (quadrant colours, selected state).
- `src/i18n.ts` — overlay placeholder, submit label, optional permission hint.
- `src/main.ts` — `initQuickAddBridge()` in `main()`; optional help-panel row documenting double-Ctrl (macOS only).
- `src/views/todo.ts` — export `refreshTodo()` or reuse existing `render()` for bridge callback.

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/src/lib.rs` — implement double-Ctrl CGEventTap + `show_quick_add`/`hide_quick_add`; center window on screen; register in `setup_app` (macOS only).
- [x] `src-tauri/tauri.conf.json` + `capabilities/quick-add.json` — define `quick-add` window and permissions.
- [x] `quick-add.html` + `src/quick-add.ts` — Spotlight-style panel: text input, four quadrant chips, Enter/Esc handling, persist via store.
- [x] `src/style.css` — overlay backdrop + compact centered panel styles using existing design tokens.
- [x] `src/i18n.ts` — EN+AR strings for overlay-specific copy.
- [x] `src/quick-add-bridge.ts` + `src/main.ts` + `src/views/todo.ts` — listen for `quick-add:task-added`, re-render Tasks list.
- [x] `src/main.ts` — document double-Ctrl in help panel under General group (macOS note).

**Acceptance Criteria:**
- Given the macOS Tauri app with Input Monitoring granted, when I double-tap Control within ~350 ms, then a centered overlay appears with a focused task input and quadrant chips (default `q2` selected).
- Given the overlay open with text "Buy milk" and `q1` selected, when I press Enter, then the task is saved to the active session with `quadrant: "q1"`, the overlay closes, and the Tasks page shows the new item after opening the main window.
- Given the overlay open, when I press Esc or double-tap Control again, then the overlay closes and no task is added.
- Given the main window hidden during a Pomodoro session, when I quick-add a task, then `data.json` contains the task and it appears on Tasks after restoring the main window.
- Given `pnpm dev` browser preview, when I double-tap Control, then nothing happens (no errors).

## Verification

**Commands:**
- `pnpm build` — expected: TypeScript + Vite build succeed.
- `pnpm tauri dev` (macOS) — expected: Rust compiles; overlay toggles on double-Ctrl.

**Manual checks:**
- Grant Input Monitoring in System Settings → Privacy; restart app; double-Ctrl opens overlay; add task in each quadrant; verify Tasks/Sort views reflect it; test dismiss paths; test while main window is tray-hidden.

## Design Notes

Double-tap detection lives in Rust: on Control `keyDown`, if previous Control down was within 350 ms and no other key intervened, emit toggle. Use `CGEventTap` at HID level (same permission model as Raycast/Alfred). The overlay window loads `quick-add.ts`, which calls `store.init()` independently — same pattern as reading/writing `data.json` from any webview. Main window subscribes to `quick-add:task-added` and calls todo `render()`. Window config: full-screen transparent webview with a CSS dimmed backdrop; inner panel ~480 px wide, auto height, vertically ~35% from top (Spotlight-like).

## Suggested Review Order

**System hotkey + overlay window**

- CGEventTap double-Ctrl detector and overlay toggle entry point.
  [`lib.rs:374`](../../src-tauri/src/lib.rs#L374)

- Show/hide overlay sized to the primary monitor.
  [`lib.rs:318`](../../src-tauri/src/lib.rs#L318)

**Overlay UI + task persistence**

- Chip selection, submit, and immediate `data.json` write.
  [`quick-add.ts:58`](../../src/quick-add.ts#L58)

- Dedicated overlay window shell and Vite entry.
  [`quick-add.html:14`](../../quick-add.html#L14)

**Main-window sync**

- Reload store and refresh Tasks after overlay save.
  [`quick-add-bridge.ts:11`](../../src/quick-add-bridge.ts#L11)

**Peripherals**

- Tauri window config and capability permissions.
  [`tauri.conf.json:41`](../../src-tauri/tauri.conf.json#L41)

- Spotlight-style panel styles.
  [`style.css:2689`](../../src/style.css#L2689)
