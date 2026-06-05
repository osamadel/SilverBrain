---
title: 'Native macOS sidebar shell'
type: 'feature'
created: '2026-06-05'
status: 'done'
context: []
baseline_commit: '222ff7664f86315f69054b0314fcf3f14e4e5d8c'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app uses a generic top header bar plus the OS title bar, which feels like a web page rather than a native macOS app.

**Approach:** Remove the OS title bar via Tauri's `Overlay` title-bar style (keeping the real native traffic-light buttons), and convert the horizontal top header into a collapsible left sidebar: logo on top, vertical nav below, settings pinned at the bottom. A hamburger button toggles the sidebar; the native traffic lights stay fixed at the top-left so they remain visible whether the sidebar is shown or hidden. In the same minimalist spirit, flatten the Sort page's off-canvas tasks drawer into an always-visible static list column to the left of the Eisenhower matrix.

## Boundaries & Constraints

**Always:** Keep the existing `.tab[data-view]` nav contract and `#settingsBtn` id so current JS keeps working. Use the real native macOS window controls (close/minimize/maximize) — not faux HTML buttons. The window must remain draggable now that the title bar is gone (a `data-tauri-drag-region` area). Reserve vertical space at the sidebar top so the logo never sits under the native traffic lights.

**Ask First:** Changing default window size/min-size; persisting collapse state anywhere other than `localStorage`.

**Never:** No new dependencies. Do not rebuild the tab/view-switching logic, settings modal, or any view's internals. Do not implement custom window-control buttons.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Toggle collapse | Sidebar shown, click hamburger | Sidebar hides; main content reclaims width; hamburger + native traffic lights stay visible | N/A |
| Toggle expand | Sidebar hidden, click hamburger | Sidebar reappears with logo/nav/settings | N/A |
| Reload while collapsed | `localStorage` collapse flag set | App restores collapsed state on load | If storage unavailable, default to shown |
| Drag window | Cursor on sidebar header empty area | Window moves | N/A |
| Open Sort page | Navigate to Sort | Tasks list is shown as a static column left of the matrix (no drawer handle, no toggle) | N/A |

</frozen-after-approval>

## Code Map

- `src-tauri/tauri.conf.json` -- window config; add native overlay title-bar style
- `index.html` -- replace `<header id="appHeader">` with `<aside id="sidebar">`; add fixed hamburger toggle; remove the `#drawerHandle` button in the Sort view
- `src/style.css` -- `body` row layout (line 96/103), replace HEADER block (lines 481–601) with sidebar styles, vertical `.tab`, collapse transition; restyle `.sort-drawer`/`.drawer-*` (lines 1645–1741) into a static column
- `src/main.ts` -- wire hamburger toggle + persist; nav wiring (line 310) stays unchanged
- `src/views/sort.ts` -- remove the `#drawerHandle` toggle wiring (line 162); drawer is now always visible

## Tasks & Acceptance

**Execution:**
- [x] `src-tauri/tauri.conf.json` -- add `"titleBarStyle": "Overlay"` and `"hiddenTitle": true` to the `main` window object -- removes OS title bar while keeping native traffic lights inset over the webview
- [x] `index.html` -- replace the `#appHeader` block with an `<aside id="sidebar">`: a top header (`data-tauri-drag-region`) with brand logo + name, a vertical `<nav class="tab-nav">` reusing the four existing `.tab[data-view]` buttons, and `#settingsBtn` pinned at the bottom; add a fixed `<button id="sidebarToggle">` (hamburger icon) positioned just right of the traffic lights -- delivers the sidebar shell
- [x] `src/style.css` -- set `body` to `flex-direction: row`; replace the HEADER rules with `#sidebar` (fixed-width left panel, top padding clearing the traffic lights, settings pinned via `margin-top:auto`, `border-inline-start`/`-end` logical props for RTL), vertical `.tab` (full-width, icon+label, left-aligned), `body.sidebar-collapsed #sidebar` (width 0 / hidden), and `#sidebarToggle` fixed top-left styling -- lays out the native shell
- [x] `src/main.ts` -- add a listener on `#sidebarToggle` that toggles `body.classList` `sidebar-collapsed` and writes the flag to `localStorage`; read it on init to restore state -- wires the collapse behavior
- [x] `index.html` + `src/style.css` + `src/views/sort.ts` -- remove the `#drawerHandle` button and its toggle wiring; restyle `.sort-drawer` to `position: static`, no transform/box-shadow, fixed-width flex column that sits left of `.matrix-panel` (keep `.drawer-list` + `.drawer-add` intact, keep RTL via logical props) -- makes the unsorted-tasks list a permanent left column

**Acceptance Criteria:**
- Given the app is launched, when it renders, then there is no OS title bar but the native close/minimize/maximize buttons appear at the top-left over the sidebar.
- Given the sidebar is shown, when the user clicks the hamburger, then the sidebar hides and the hamburger plus native traffic lights remain visible and functional.
- Given the sidebar is hidden and the app is reloaded, when it loads, then the sidebar stays hidden (state persisted).
- Given any sidebar state, when the user clicks a nav tab, then the corresponding view activates exactly as before.
- Given the title bar is removed, when the user drags the sidebar header's empty area, then the window moves.
- Given the user is on the Sort page, when it renders, then the unsorted tasks appear as a static list column to the left of the matrix with no drawer handle, and drag-to-quadrant plus the add-task form still work.

## Design Notes

Tauri v2 `titleBarStyle: "Overlay"` (macOS) keeps decorations on and insets the native traffic lights over the webview at a fixed top-left position, so they are inherently "unaffected" by sidebar collapse. Reserve ~40px top padding on the sidebar and place `#sidebarToggle` at roughly `left: 76px` so it clears the lights. Persist collapse as a simple `localStorage` boolean read synchronously before first paint to avoid a flash.

## Verification

**Commands:**
- `pnpm build` -- expected: TypeScript + Vite build succeeds with no errors

**Manual checks:**
- `pnpm tauri dev` -- no OS title bar; native traffic lights at top-left work; hamburger toggles the sidebar; logo on top, settings at bottom; nav switches views; window drags from the sidebar header.

## Suggested Review Order

**Native window shell (Tauri)**

- Entry point — removes the OS title bar while keeping native traffic lights inset over the webview.
  [`tauri.conf.json:20`](../../src-tauri/tauri.conf.json#L20)

**Sidebar markup & layout**

- The new shell: fixed hamburger + `<aside id="sidebar">` (draggable header, vertical nav, settings pinned bottom).
  [`index.html:258`](../../index.html#L258)

- `body` flips to row; `#sidebar` is the fixed-width left panel with collapse transition.
  [`style.css:484`](../../src/style.css#L484)

- Fixed hamburger sits right of the traffic lights (z-index 150 so overlays cover it).
  [`style.css:536`](../../src/style.css#L536)

**Collapse behavior**

- Toggle wiring + guarded `localStorage` persistence; restore runs before first paint.
  [`main.ts:20`](../../src/main.ts#L20)

**Sort page de-clutter**

- Off-canvas drawer becomes a static column left of the matrix.
  [`style.css:1681`](../../src/style.css#L1681)

- Drawer handle markup removed; list is always visible.
  [`index.html:363`](../../index.html#L363)

- Drops the `#drawerHandle` toggle wiring (list no longer collapses).
  [`sort.ts:160`](../../src/views/sort.ts#L160)
