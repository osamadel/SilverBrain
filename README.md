# SilverBrain

A cross-platform desktop productivity app that takes a messy **brain dump**, uses
an LLM to extract and pre-sort tasks, lets you refine them on an **Eisenhower
Matrix**, carries them into a **Tasks** checklist, and runs a **Focus**
(Pomodoro) timer.

Built with [Tauri 2](https://tauri.app) (Rust + WebView), a vanilla
TypeScript/Vite frontend, and [LangChain.js](https://js.langchain.com) for
multi-provider LLM support.

## Features

### Workflow

- **Brain Dump** — a focused, distraction-free canvas for freeform capture.
  Press **⌘/Ctrl+Enter** (or click Extract) to run extraction; the app creates
  a titled session and navigates to Sort.
- **Sort** — unsorted tasks in a left column; drag them into the Eisenhower
  Matrix (*Do First / Schedule / Delegate / Eliminate*). Export to Markdown
  (Obsidian-friendly) or finish sorting to move on to Tasks.
- **Tasks** — persistent checklist grouped by quadrant, with done-state and
  quadrant badges; send any item to the Focus timer.
- **Focus** — Pomodoro cycles (focus / short / long break) with configurable
  durations and an automatic long-break interval.

### Sessions & history

Each extraction creates a **brain-dump session** (LLM-generated title, summary,
dump text, and unified task list). Past sessions are listed in a history dialog
and can be restored at any time. Legacy `data.json` files are migrated
automatically on first load.

### Sort memory

The app learns how you sort work over time. On extraction, the LLM pre-places
tasks using your custom prompt plus any learned preferences stored in
`memory.md`. When you finish sorting, a background learning pass compares the
model's suggestions to your final placements and rewrites `memory.md` — later
extractions get smarter.

### LLM providers

Anthropic (Claude), OpenAI, Google Gemini, and local Ollama. Switch provider,
model, and API keys in Settings. The task-extraction prompt is viewable,
editable, and resettable there too.

### Native shell (macOS)

Overlay title bar with real traffic-light controls; collapsible left sidebar
(logo, vertical nav, settings pinned at the bottom). The sidebar auto-collapses
on the Brain Dump page for a calm, isolated capture experience.

### Internationalization

Full **English / Arabic (Egyptian)** UI switch in Settings. Arabic mode applies
RTL layout, Noto Sans Arabic, and the title *فضي دماغك*.

### Keyboard shortcuts

Press **⌘/Ctrl+/** in the app to open the shortcuts panel. Highlights:

| Shortcut | Action |
| -------- | ------ |
| ⌘/Ctrl+Enter | Extract (Brain Dump) · Finish Sorting (Sort) · Focus first task (Tasks) |
| ⌘/Ctrl+, | Open Settings |
| ⌘/Ctrl+B | Toggle sidebar |
| ⌘/Ctrl+P | Open session history |
| ⌘/Ctrl+Shift+] / [ | Next / previous page (cycles); cycles Settings tabs when modal is open |
| ⌘/Ctrl+L | Toggle done on focused task (Tasks) |
| ↑ / ↓ | Cycle task focus (Tasks) |
| Esc | Close open modal / panel |

### Privacy

Provider choice, model, API keys, sessions, and sort memory are stored in plain
local files on your machine — never bundled, never uploaded anywhere except the
LLM provider you configure.

## Where your data lives

| File | Location (macOS) | Contents |
| ---- | ---------------- | -------- |
| `settings.json` | `~/Library/Application Support/com.silverbrain.desktop/` (app **config** dir) | provider, model, API keys, language, extraction prompt, theme |
| `data.json` | same app **data** dir | brain-dump sessions, active session, draft dump, pomodoro stats |
| `memory.md` | same app **data** dir | learned Eisenhower sort preferences (markdown prose) |

On Linux/Windows these resolve to the platform's standard config/data dirs.

## How LLM calls work

LLM requests are made from the frontend via LangChain, but routed through Tauri's
HTTP plugin (`@tauri-apps/plugin-http`). That proxies the request through the Rust
process, which sidesteps the WebView's CORS restrictions — so you can call
provider APIs directly with a key read from the local config file.

Three call types:

1. **Extraction** — parses tasks (with quadrant guesses) from a dump; injects
   `memory.md` content when present.
2. **Session meta** — generates a short title and summary for a new session.
3. **Sort learning** — on Finish Sorting, distills corrections into updated
   `memory.md` prose (runs in the background; navigation to Tasks is immediate).

Allowed endpoints are declared in
[`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json). Add a
provider domain there if you wire up a new one.

## Prerequisites

- [Node.js](https://nodejs.org) + [pnpm](https://pnpm.io)
- [Rust](https://rustup.rs) toolchain
- Tauri OS dependencies — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

## Development

```bash
pnpm install
pnpm tauri dev      # run the desktop app with hot reload
```

## Build a distributable

```bash
pnpm tauri build    # produces installers in src-tauri/target/release/bundle/
```

## Adding another LLM provider

1. Install its LangChain package and add a `case` in
   [`src/llm.ts`](src/llm.ts) `buildModel()`.
2. Add a `ProviderMeta` entry to the `PROVIDERS` array (label, default model, hints).
3. Add defaults to `DEFAULT_SETTINGS.providers` in [`src/config.ts`](src/config.ts).
4. Allow its API domain in [`src-tauri/capabilities/default.json`](src-tauri/capabilities/default.json).

## Project layout

```
index.html              # app shell (sidebar, 4 views, settings/history/export modals)
src/
  main.ts               # bootstrap, sidebar, 4-view nav, settings tabs, shortcuts
  config.ts             # settings/data/memory persistence (Tauri fs)
  store.ts              # in-memory state + debounced save; session helpers
  llm.ts                # LangChain multi-provider, extraction, sort learning
  i18n.ts               # en/ar translations + applyLanguage (RTL)
  toast.ts              # non-blocking status toasts
  notifications.ts      # desktop notifications (Focus timer)
  views/
    braindump.ts        # minimal dump page + extract + history
    sort.ts             # Eisenhower matrix, drag-and-drop, export, finish sorting
    todo.ts             # quadrant-grouped task checklist
    pomodoro.ts         # focus timer
src-tauri/              # Rust host (fs + http + notification plugins)
```
