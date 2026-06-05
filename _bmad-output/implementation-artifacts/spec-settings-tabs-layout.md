---
title: 'Settings panel: tabbed layout with About tab and tab-nav shortcuts'
type: 'feature'
created: '2026-06-05'
status: 'completed'
context: []
baseline_commit: 'c14ba893eb50cd3414dba4db1a1ea5f64e976148'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Settings modal stacks six collapsible accordion sections, which is noisy, hides content behind toggles, and has no place for app identity/version info.

**Approach:** Replace the accordions with a horizontal tab strip. Add a new **About** tab (first/default) showing the app icon, name, version, platform, and Tauri version. Wire `Cmd/Ctrl+Shift+]` / `[` to move to the next/previous tab while the Settings modal is open (these keys currently only page-navigate and are inert when a modal is open).

## Boundaries & Constraints

**Always:** Keep all existing settings controls, their element `id`s, and save/load logic unchanged — only the surrounding layout changes. Preserve i18n (`data-i18n`) coverage incl. Arabic and RTL. Match existing design tokens/styles (no new colors). Tab strip and panels use ARIA roles (`tablist`/`tab`/`tabpanel`). Version/platform lookup must degrade gracefully in the browser preview (non-Tauri).

**Ask First:** Adding any new runtime dependency or Tauri OS plugin.

**Never:** Change settings persistence/schema, change unrelated keyboard shortcuts, or change page-navigation behavior when the Settings modal is NOT open.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Open settings | User opens modal | About tab active by default; its panel visible, others hidden | N/A |
| Click a tab | Click tab button | That panel shows, others hide; `aria-selected` updates | N/A |
| Next tab | Settings open, `Cmd/Ctrl+Shift+]` | Activate next tab, wrapping after last → first | N/A |
| Prev tab | Settings open, `Cmd/Ctrl+Shift+[` | Activate previous tab, wrapping before first → last | N/A |
| Tab nav when settings closed | `Cmd/Ctrl+Shift+]/[`, no modal open | Page navigation (unchanged) | N/A |
| About in Tauri | Running in desktop app | Version + Tauri version from runtime API; platform from navigator | If API throws, fall back to build-time version |
| About in browser | Vite preview (no Tauri) | Build-time version (`__APP_VERSION__`), platform from navigator, Tauri version hidden/omitted | No crash |

</frozen-after-approval>

## Code Map

- `index.html` -- Settings modal markup (lines ~54-244): six `.modal-section` accordions to replace with `.modal-tabs` strip + `.modal-tabpanel`s; add About panel.
- `src/main.ts` -- `wireCollapsibleSections()` (l.230), `wireSettingsModal()` (l.236), `openSettings()` (l.185), `wireGlobalShortcuts()` Cmd+Shift+[/] handler (l.533-538), `HELP_GROUPS` (l.350).
- `src/style.css` -- `.modal-section*` accordion styles (l.446-488) to replace with tab styles.
- `src/i18n.ts` -- `section-*` / `settings-*` keys (l.34-60); add About + tab-label + help strings (en + ar).
- `vite.config.ts` -- add `define` for `__APP_VERSION__` from package.json.

## Tasks & Acceptance

**Execution:**
- [x] `index.html` -- Replace the six `.modal-section` blocks with a `.modal-tabs` strip (icon + short label per tab, `role=tablist`) and matching `.modal-tabpanel` blocks (`role=tabpanel`); prepend a new **About** panel (logo `img`, app name, and `<dl>`/rows for version, platform, Tauri version with stable ids e.g. `aboutVersion`, `aboutPlatform`, `aboutTauri`). Keep all existing field ids/markup intact inside their panels.
- [x] `src/style.css` -- Remove accordion-specific rules; add `.modal-tabs` (horizontal, scrollable if overflow), `.modal-tab`/`.modal-tab.active`, `.modal-tabpanel`/`[hidden]`, and About-row styling using existing tokens.
- [x] `src/main.ts` -- Replace `wireCollapsibleSections` with `wireSettingsTabs` (click → `activateSettingsTab(index)`, ARIA, default index 0=About) and add `cycleSettingsTab(dir)`; populate About fields in `openSettings` via `@tauri-apps/api/app` (`getVersion`, `getTauriVersion`) when `isTauri()` else `__APP_VERSION__`, platform derived from `navigator`; in `wireGlobalShortcuts`, when the Settings modal is the open modal, route `Cmd/Ctrl+Shift+]/[` to `cycleSettingsTab` instead of returning early; update `kb-*-page` help descriptions to note tab switching.
- [x] `src/i18n.ts` -- Add `about` tab label, `about-version`/`about-platform`/`about-tauri` labels, and short tab labels (e.g. `tab-llm`, `tab-prompt`, `tab-pomodoro`) for en + ar; reuse existing `section-*` strings where suitable.
- [x] `vite.config.ts` -- Add `define: { __APP_VERSION__: JSON.stringify(version) }` (read from package.json); declare `__APP_VERSION__` for TS.

**Acceptance Criteria:**
- Given the Settings modal, when it opens, then a horizontal tab strip is shown with About active and exactly one panel visible.
- Given any open settings tab, when the user presses `Cmd/Ctrl+Shift+]` or `[`, then the active tab advances/retreats with wraparound and the corresponding panel shows.
- Given no modal is open, when the user presses those keys, then page navigation behaves exactly as before.
- Given the desktop build, when the About tab is viewed, then app version, platform, and Tauri version are populated; in browser preview it shows the build-time version without errors.
- Given Arabic is selected, when the modal opens, then tabs and About labels are translated and lay out correctly under RTL.

## Design Notes

Seven tabs (About, Model, Appearance, Extraction, Tasks, Pomodoro, Language) must fit a 480px modal — use icon + short label, `overflow-x: auto` with hidden scrollbar as fallback. Toggle panels with the `hidden` attribute (not display in CSS only) so screen readers skip inactive panels. Platform string: map `navigator.userAgent`/`platform` to "macOS"/"Windows"/"Linux"; reuse the existing `IS_MAC` detection idiom.

## Verification

**Commands:**
- `pnpm build` -- expected: type-check + Vite build succeed with no errors.

**Manual checks:**
- In `pnpm dev` browser preview: open Settings → About active, click each tab, press `Cmd+Shift+]`/`[` to cycle with wraparound, confirm version shows; switch to Arabic and confirm RTL + translated tabs; close modal and confirm `Cmd+Shift+]`/`[` still page-navigates.
