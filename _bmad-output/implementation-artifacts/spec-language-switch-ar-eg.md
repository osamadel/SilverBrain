---
title: 'Language Switch: English / Arabic (Egyptian)'
type: 'feature'
created: '2026-06-04'
status: 'done'
baseline_commit: 'NO_VCS'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** SilverBrain is English-only; there is no way to switch the UI language to Arabic, which limits accessibility for Arabic-speaking users.

**Approach:** Add a language selector (English / Arabic) to the Settings modal. When Arabic is selected, the full UI switches to RTL layout with Egyptian-dialect translations, the Noto Sans Arabic font, and the Arabic app title "فضي دماغك".

## Boundaries & Constraints

**Always:**
- Persisted to `AppSettings` (settings.json via Tauri) under a `language` field (`'en' | 'ar'`); defaults to `'en'`
- Language is applied on app init (from stored value) and immediately on settings save
- RTL switch is done by setting `dir="rtl"` on `<html>` and toggling a `.rtl` CSS class; no layout restructuring
- Arabic font is Noto Sans Arabic (variable weight, 100–900) loaded from Google Fonts
- All static UI strings carry a `data-i18n` attribute keyed to a translation dictionary; no third-party i18n library

**Ask First:**
- If any translated string feels unnatural or needs dialect review before shipping

**Never:**
- Do not translate LLM prompt strings or AI-generated content
- Do not introduce a React/Vue component or any npm i18n library
- Do not change the app's OS-level product name in tauri.conf.json (keep "Silver Brain")

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First load, no stored language | No `language` key in settings.json | App renders in English, LTR | — |
| User switches to Arabic and saves | `language: 'ar'` stored | Full UI switches to Arabic text, RTL dir, Arabic font, title "فضي دماغك" | — |
| User switches back to English and saves | `language: 'en'` stored | Full UI reverts to English text, LTR, original fonts | — |
| Settings modal opened in Arabic | `language: 'ar'` active | Language select shows "العربية (مصري)" as selected value | — |
| App reloaded with Arabic stored | `language: 'ar'` in settings.json | Language applied before first paint (init applies before showing content) | — |

</frozen-after-approval>

## Code Map

- `index.html` -- app shell; settings modal; all static UI strings; font `<link>` tags
- `src/config.ts` -- `AppSettings` interface + default values; settings load/save
- `src/store.ts` -- in-memory settings holder; exposes `store.settings`
- `src/main.ts` -- `openSettings()`, `saveSettingsFromModal()`; init flow; brand name span
- `src/style.css` -- CSS custom properties for fonts; RTL layout overrides
- `src/i18n.ts` -- new file: translation dictionary + `applyLanguage(lang)` function

## Tasks & Acceptance

**Execution:**
- [x] `src/i18n.ts` -- CREATE: export `translations` dict (keys = `data-i18n` attr values, values = `{ en, ar }` strings) for every user-visible UI string; export `applyLanguage(lang: 'en' | 'ar')` that iterates `[data-i18n]` elements, swaps `textContent`/`placeholder`, sets `document.title`, toggles `dir="rtl"` on `<html>`, and toggles `.rtl` class on `<html>`
- [x] `index.html` -- ADD `data-i18n` attributes to every static user-visible string (nav tabs, settings modal labels, buttons, onboarding text, brand name span, empty states); ADD Noto Sans Arabic Google Fonts `<link>` before the existing font links; ADD language `<select>` with options English / العربية (مصري) inside the settings modal, before the Save button
- [x] `src/config.ts` -- ADD `language: 'en' | 'ar'` to `AppSettings` interface; ADD `language: 'en'` to the default settings object returned when file is missing
- [x] `src/main.ts` -- IMPORT `applyLanguage` from `./i18n`; CALL `applyLanguage(store.settings.language ?? 'en')` at end of `main()` init; WIRE language select in `openSettings()` (populate from `store.settings.language`) and `saveSettingsFromModal()` (read value, persist to `store.settings.language`, call `applyLanguage`); UPDATE `refreshSettingsBtn()` if it references brand label text
- [x] `src/style.css` -- ADD `--font-arabic: 'Noto Sans Arabic', sans-serif` to `:root`; ADD `[dir="rtl"]` block with `font-family: var(--font-arabic)`, text-align right for relevant containers, and any mirrored flex/margin adjustments needed for header and modal layout

**Acceptance Criteria:**
- Given the app is freshly loaded with no stored language, when the app renders, then all UI text is in English and layout is LTR
- Given the settings modal is open, when the user selects "العربية (مصري)" and saves, then the brand name shows "فضي دماغك", all `data-i18n` elements show Arabic text, `<html dir="rtl">` is set, and Noto Sans Arabic is used for body text
- Given Arabic is active, when the user opens settings, then the language select shows "العربية (مصري)" as the current value
- Given Arabic is saved and the app is reloaded, when the app initializes, then Arabic text and RTL layout are applied without a flash of English
- Given Arabic is active, when the user switches back to English and saves, then all text reverts, `dir="rtl"` is removed, and Latin fonts are restored

## Design Notes

`applyLanguage` runs at init (before any view is shown) and on every save. It should be idempotent — calling it twice with the same language is safe.

`data-i18n` keys use snake_case matching the English default, e.g. `brain-dump-tab`, `settings-title`, `save-btn`. The function uses `document.querySelectorAll('[data-i18n]')` and falls back to English if a key is missing from the dict.

For `<input placeholder>` translation, use a `data-i18n-placeholder` attribute so the same element can carry both a label key and a placeholder key without collision.

## Suggested Review Order

**i18n foundation — understand the design before reading anything else**

- Translation dict, `t()` with safe split/join interpolation, and lang guard
  [`i18n.ts:1`](../../src/i18n.ts#L1)

- `applyLanguage()`: dir toggle, `[data-i18n]` DOM sweep, placeholder swap, title
  [`i18n.ts:134`](../../src/i18n.ts#L134)

**Settings persistence & wiring**

- `AppLanguage` type + `language` field added to `AppSettings`
  [`config.ts:21`](../../src/config.ts#L21)

- Init: `applyLanguage` fires before any view renders — prevents flash of English
  [`main.ts:201`](../../src/main.ts#L201)

- `openSettings()` populates the language select from stored value
  [`main.ts:152`](../../src/main.ts#L152)

- `saveSettingsFromModal()` persists, calls `applyLanguage`, refreshes dynamic UI
  [`main.ts:163`](../../src/main.ts#L163)

**Dynamic string updates in views**

- `MODE_I18N_KEYS` + `setMode()` keeps `data-i18n` attr in sync for language-change sweeps
  [`pomodoro.ts:29`](../../src/views/pomodoro.ts#L29)

- `renderTime()` uses `t()` for Start/Pause and session count
  [`pomodoro.ts:34`](../../src/views/pomodoro.ts#L34)

- `refreshPomodoroI18n()` — called by main.ts on save to re-render pomodoro chrome
  [`pomodoro.ts:129`](../../src/views/pomodoro.ts#L129)

- `QUADRANT_BADGE_KEY` + `GROUP_I18N_KEYS` replace hardcoded label strings
  [`todo.ts:11`](../../src/views/todo.ts#L11)

- `render()` applies `t()` for stats, group headings, badges, empty state
  [`todo.ts:33`](../../src/views/todo.ts#L33)

- Status texts during extraction use `t()`
  [`braindump.ts:50`](../../src/views/braindump.ts#L50)

- `updateBottomBar()` uses `t()` for placed-info and tasks-placed label
  [`braindump.ts:212`](../../src/views/braindump.ts#L212)

**HTML surface + CSS**

- Noto Sans Arabic Google Fonts link (variable weight 100–900)
  [`index.html:8`](../../index.html#L8)

- Language select section in settings modal
  [`index.html:120`](../../index.html#L120)

- `--font-arabic` token + `[dir="rtl"]` CSS block overriding font vars
  [`style.css:47`](../../src/style.css#L47)

## Verification

**Commands:**
- `pnpm run build` -- expected: exits 0, no TypeScript errors

**Manual checks (if no CLI):**
- Open Settings → select Arabic → Save → confirm brand shows "فضي دماغك", tabs are in Arabic, layout is RTL, font visibly changes to Noto Sans Arabic
- Reload the app → confirm Arabic is still active (no English flash)
- Switch back to English → confirm full revert
