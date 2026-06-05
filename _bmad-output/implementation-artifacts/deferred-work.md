# Deferred Work

Pre-existing issues surfaced during review of `spec-braindump-wizard-flow` (2026-06-04). Not caused by that change; collected for focused attention.

## 1. Partial-state data.json migration can crash views (HIGH)
`readJson` in `src/config.ts:90` shallow-merges `{ ...fallback, ...JSON.parse(raw) }`. A `data.json` written by an older schema that contains a *partial* `matrix` (e.g. only `q1`) replaces the whole `matrix` object, leaving `q2/q3/q4` undefined. `placedCount()` (`src/views/braindump.ts`) then does `store.data.matrix[q].length` → throws, crashing the Brain Dump view on load. Same shallow-merge hazard applies to the `pomodoro` object.
**Fix direction:** deep-merge nested objects in `readJson`, or normalize/default each quadrant + pomodoro field after load.

## 3. Copy button innerHTML race on language switch (LOW)
Surfaced during review of `spec-language-switch-ar-eg` (2026-06-04).
In `src/views/braindump.ts`, the copy handler captures `btn.innerHTML` and restores it 2 seconds later. If the user switches language within that window, the restored markup carries stale-language text. Extremely unlikely in practice.
**Fix direction:** On restore, instead of `btn.innerHTML = original`, reconstruct the button from its `data-i18n` key by calling `applyLanguage` again on that element, or store only the icon part and re-apply translation.

## 4. `applyLanguage` will silently clobber child nodes if data-i18n is ever placed on a non-leaf element (LOW)
Surfaced during review of `spec-language-switch-ar-eg` (2026-06-04). Currently all `[data-i18n]` attributes are on leaf elements, so this is safe. But there's no runtime guard — a future developer adding `data-i18n` to a container element would silently lose its icon children.
**Fix direction:** Add a `console.warn` in `applyLanguage` when `el.children.length > 0`.

## 2. Duplicate extracted-task text collapses in the matrix (MEDIUM)
Tasks are keyed by their raw string (`src/views/braindump.ts` `renderTasks`/drop guard). If the LLM extracts two identical strings, placing one marks both as placed, and the drop guard `!matrix[q].includes(task)` prevents the second from ever being placed — two distinct tasks collapse into one.
**Fix direction:** give each extracted task a stable id/index and key DnD + placement on that instead of the text.

## 5. Dead onboarding carousel DOM (LOW)
Surfaced during review of `spec-zen-calm-ui` (2026-06-05). `#onboardingOverlay` markup and CSS remain in `index.html` / `style.css` but JS no longer drives it. Safe while hidden; remove in a cleanup pass.

## 6. `bdInfoBtn` title not wired to i18n (LOW)
Surfaced during review of `spec-zen-calm-ui` (2026-06-05). Hardcoded `title` on the info button won't update on language switch (`bd-info` key exists in i18n).
**Fix direction:** use `data-i18n-title` or set title in `applyLanguage`.
