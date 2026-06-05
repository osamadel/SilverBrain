---
title: 'Eisenhower sort memory (memory.md)'
type: 'feature'
created: '2026-06-05'
status: 'done'
baseline_commit: 'f05e06c7ac2a9bda7ac5e2776650b6ffc148e7b4'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** After extraction, every task lands unsorted in the drawer; the model never applies Eisenhower placement, and the app forgets how the user actually sorts work across sessions.

**Approach:** Persist learned urgency/importance heuristics in `memory.md` under the app data directory (empty at first). On extract, the LLM returns tasks with a best-guess quadrant using the extraction prompt plus any memory content. The user corrects placement via the existing Sort UI. On **Finish Sorting**, a dedicated learning prompt compares the session dump, each task’s model suggestion, and the user’s final quadrant, then rewrites `memory.md` with distilled preferences. Later extractions inject that memory into the prompt so assignments improve over time.

## Boundaries & Constraints

**Always:** Store `memory.md` in the same app data dir as `data.json` via existing Tauri fs helpers. Keep drag-and-drop Sort UX unchanged. Preserve user-editable extraction prompt in Settings; memory augments it, not replaces it. Track model suggestion separately from user-facing `quadrant` so learning can diff them. Show non-blocking status on Sort while learning runs; still navigate to Tasks when done. Support en/ar status strings for new UI copy.

**Ask First:** Changing `SessionTask` shape beyond optional `suggestedQuadrant`, or exposing memory.md for manual edit in Settings UI.

**Never:** Do not auto-finish sort or skip user review. Do not send memory to any server except the user’s configured LLM provider. Do not block extraction if memory read/learn fails (fall back to unplaced or prior memory). Do not add new npm dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First launch | `memory.md` missing | Treat as empty string; extract with quadrant guesses only from default prompt | Create file on first successful learn |
| Extract with empty memory | Dump + provider OK | JSON array of `{text, quadrant}`; tasks created with `quadrant` and `suggestedQuadrant` set to model guess; matrix pre-filled | On parse error, same as today: show error, no session advance |
| Extract with memory | Non-empty `memory.md` | Prompt includes a “Learned preferences” section; assignments follow memory + dump | If memory read fails, extract without memory |
| User adjusts sort | Drag between drawer/quadrants | `quadrant` updates; `suggestedQuadrant` unchanged | n/a |
| Finish sorting | ≥1 task with any quadrant (including drawer `""`) | Fire learn LLM with dump + per-task suggested vs final; replace `memory.md` body; then switch to Tasks | On learn failure: toast/status error, still switch to Tasks; keep old memory |
| Finish with no tasks | Empty session task list | Skip learn; go to Tasks | n/a |
| Provider not configured | Finish clicked | No learn call | Navigate to Tasks |
| Legacy tasks | Tasks without `suggestedQuadrant` | Treat suggestion as current `quadrant` or `""` for learn diff | n/a |

</frozen-after-approval>

## Code Map

- `src/config.ts` -- add `MEMORY_FILE`, `loadMemory()`, `saveMemory()` using `appDataDir` + existing fs patterns
- `src/llm.ts` -- quadrant-aware extraction prompt/parse; `learnSortPreferences()` with dedicated learn prompt; inject `{memory}` / memory block into extract prompt
- `src/config.ts` (`SessionTask`) -- optional `suggestedQuadrant?: Quadrant | ""`
- `src/views/braindump.ts` -- map extracted `{text, quadrant}` to tasks with both fields set
- `src/views/sort.ts` -- async `finishSortBtn`: learn then `switchToTodo`; loading state on button
- `src/i18n.ts` -- strings for learning status / errors
- `index.html` -- optional spinner/disabled state hook for finish button (if not already styled)

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` -- memory.md read/write helpers in app data dir -- persistence surface
- [x] `src/config.ts` -- extend `SessionTask` with optional `suggestedQuadrant` -- enables learn diff
- [x] `src/llm.ts` -- `extractTasksWithQuadrants(settings, dump, memory)` returning `{text, quadrant}[]`; default prompt outputs JSON objects with `q1`–`q4`; append memory section when non-empty
- [x] `src/llm.ts` -- `learnSortPreferences(settings, {dump, tasks: {text, suggested, final}[]})` returns markdown string written to memory.md
- [x] `src/views/braindump.ts` -- use new extract API; pre-place tasks per model guess
- [x] `src/views/sort.ts` -- finish handler loads memory, runs learn from active session, saves memory, handles errors
- [x] `src/i18n.ts` -- `status-learning-memory`, `status-learn-failed` (en + ar)

**Acceptance Criteria:**
- Given no `memory.md`, when the user extracts a dump, then tasks appear in matrix quadrants per model guess (not all in drawer).
- Given the user moves tasks and clicks Finish Sorting, when the provider is configured, then `memory.md` is updated with preference prose and the app navigates to Tasks.
- Given non-empty `memory.md`, when the user extracts a new dump, then the extraction prompt includes that memory and quadrant assignments reflect it.
- Given learn API failure on finish, when the user clicks Finish Sorting, then they still reach Tasks and prior memory remains unchanged.

## Design Notes

**Quadrant semantics:** `q1` Do First (urgent+important), `q2` Schedule, `q3` Delegate, `q4` Eliminate. Model may leave a task as drawer-only by returning `""` for quadrant when uncertain.

**Learn prompt (concise contract):** System analyzes patterns in corrections (e.g. “calls family” → q2 not q1) and writes durable bullet rules under headings *Urgent vs not*, *Important vs not*, *Examples* — no session IDs, no raw dumps stored wholesale.

**Extract JSON shape:** `[{"text":"Call dentist","quadrant":"q1"}, ...]` — parser accepts legacy string-only array for robustness during transition.

## Verification

**Commands:**
- `npm run build` -- expected: TypeScript compiles without errors

**Manual checks:**
- Extract with empty memory: tasks appear in quadrants; drawer only has tasks model marked `""`.
- Re-sort, Finish: `memory.md` populated under app data dir.
- Second extract: placements shift toward learned patterns.

## Suggested Review Order

**Memory persistence**

- App-data `memory.md` read/write helpers
  [`config.ts:233`](../../src/config.ts#L233)

**Extract with learned preferences**

- Builds prompt with memory block and quadrant JSON output
  [`llm.ts:211`](../../src/llm.ts#L211)

- Loads memory before extract; pre-fills matrix from model guess
  [`braindump.ts:76`](../../src/views/braindump.ts#L76)

**Learn on finish**

- Compares suggested vs final quadrant; rewrites memory.md
  [`sort.ts:149`](../../src/views/sort.ts#L149)

- Learn prompt contract for distilled preference markdown
  [`llm.ts:143`](../../src/llm.ts#L143)

**UI & copy**

- Sort bar status while learning; en/ar strings
  [`sort.ts:156`](../../src/views/sort.ts#L156)

## Spec Change Log
