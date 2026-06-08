---
title: 'Pomodoro session-end notification sound picker'
type: 'feature'
created: '2026-06-08'
status: 'done'
baseline_commit: '0faefa4c208b03e3613e78357137b960410854b7'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a Pomodoro session ends, the app plays a single hard-coded beep for every session type. Users cannot distinguish focus vs break endings by sound or pick a tone that fits their preference.

**Approach:** Add three sound pickers (focus end, short break end, long break end) to the existing Pomodoro settings tab. Ship five recognizable preset sounds synthesized via Web Audio (no binary assets). Each picker includes a preview control; the timer uses the saved preset when that session type completes.

## Boundaries & Constraints

**Always:** Persist choices in existing `data.json` pomodoro settings with sensible defaults and merge-on-load. Keep system notifications unchanged (title/body only). Match existing settings patterns (immediate persist on change, i18n en+ar, design tokens). Preview and session-end playback must fail silently if audio is unavailable. Use the same five preset ids everywhere.

**Ask First:** Adding npm audio libraries or bundling licensed `.mp3`/`.wav` assets.

**Never:** Change timer durations, auto-start toggles, tray behavior, or notification permission flow. Do not add per-session mute toggles or volume sliders in this change.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default load | Fresh install or missing sound fields | All three pickers show default preset (`digital`); focus end plays that preset | N/A |
| Legacy data | `data.json` lacks sound keys | Merge defaults; no crash | N/A |
| Change picker | User selects a preset in settings | Value saved to `store.data.pomodoro`; preview optional via button | N/A |
| Preview | User clicks preview on a row | Selected preset plays once | Silent catch if AudioContext blocked |
| Focus completes | Timer hits 0 in focus mode | System notification + **focus** preset sound | Silent catch on audio failure |
| Short break completes | Timer hits 0 in short mode | System notification + **short break** preset | Same |
| Long break completes | Timer hits 0 in long mode | System notification + **long break** preset | Same |
| Invalid stored id | Corrupt/unknown id in JSON | Fall back to `digital` on play and in UI sync | No throw |

</frozen-after-approval>

## Code Map

- `src/config.ts` — `PomodoroSettings`: add `soundFocus`, `soundShortBreak`, `soundLongBreak` typed as `NotificationSoundId`; extend `DEFAULT_DATA.pomodoro`.
- `src/notification-sounds.ts` — **new**: export `NOTIFICATION_SOUND_IDS`, labels helper, `playNotificationSound(id)`, five Web Audio presets (chime, bell, digital, pop, gentle).
- `src/views/pomodoro.ts` — replace inline oscillator in `notify()` with preset lookup by session kind; wire settings `<select>` + preview buttons in `syncSettingsInputs` / `initPomodoro`.
- `index.html` — Pomodoro settings panel: three labeled rows (select + preview button) below duration toggles.
- `src/style.css` — compact row layout for sound pickers using existing modal tokens.
- `src/i18n.ts` — section heading, three field labels, five preset names, preview button aria label (en + ar).

## Tasks & Acceptance

**Execution:**
- [x] `src/notification-sounds.ts` — Define `NotificationSoundId` union, constant list of five ids, `playNotificationSound(id)` with distinct synthesized presets; unknown id → `digital`.
- [x] `src/config.ts` — Add three sound fields to `PomodoroSettings` and defaults (all `digital` to approximate current beep).
- [x] `index.html` — Add sound picker rows: `setSoundFocus`, `setSoundShort`, `setSoundLong` selects and `previewSoundFocus`, `previewSoundShort`, `previewSoundLong` buttons.
- [x] `src/views/pomodoro.ts` — Route session-end audio through presets; bind selects (persist on change) and preview buttons; populate selects in `syncSettingsInputs`.
- [x] `src/style.css` — Style `.modal-pomo-sounds` rows (label, select, preview) consistent with pomodoro tab.
- [x] `src/i18n.ts` — Add translation keys for section title, labels, preset names, preview aria text.

**Acceptance Criteria:**
- Given Settings → Pomodoro tab, when opened, then three sound dropdowns each list exactly five named presets and reflect saved values.
- Given any sound dropdown, when the user clicks its preview button, then that preset plays once without saving a different value.
- Given a saved focus-end preset, when a focus session timer reaches zero, then the system notification appears and the focus preset plays (not short/long presets).
- Given a saved short- or long-break preset, when that break type ends, then the matching preset plays.
- Given Arabic language, when the Pomodoro settings tab is shown, then labels and preset names are translated and layout remains usable in RTL.

## Design Notes

Five presets (ids → character): `chime` (two-tone soft), `bell` (single decaying strike), `digital` (short 660 Hz blip — closest to today), `pop` (quick pitch drop), `gentle` (low ascending swell). Populate `<select>` options from `NOTIFICATION_SOUND_IDS` in TS so ids stay single-sourced. Preview buttons use `type="button"` and `aria-label` from i18n.

## Verification

**Commands:**
- `pnpm build` — expected: type-check and Vite build succeed.

**Manual checks:**
- Open Pomodoro settings → pick different sounds for each session type → preview each → run timer (or skip session) and confirm end sound matches the saved preset for focus, short break, and long break.

## Suggested Review Order

**Sound presets & playback**

- Five Web Audio presets with safe fallback for unknown ids.
  [`notification-sounds.ts:97`](../../src/notification-sounds.ts#L97)

- Session-end routing picks the saved preset by focus / short / long mode.
  [`pomodoro.ts:146`](../../src/views/pomodoro.ts#L146)

**Persistence**

- Three sound fields on `PomodoroSettings`, merged from defaults on load.
  [`config.ts:39`](../../src/config.ts#L39)

**Settings UI**

- Three dropdowns with preview buttons in the Pomodoro tab.
  [`index.html:233`](../../index.html#L233)

- Select population, persist-on-change, and preview wiring.
  [`pomodoro.ts:443`](../../src/views/pomodoro.ts#L443)

**Presentation & i18n**

- Sound picker layout using existing modal tokens.
  [`style.css:709`](../../src/style.css#L709)

- en + ar labels for section, fields, and preset names.
  [`i18n.ts:224`](../../src/i18n.ts#L224)
