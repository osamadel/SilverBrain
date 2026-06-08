# SilverBrain

A cross-platform desktop productivity app that takes a messy **brain dump**, uses
an LLM to extract clean tasks, lets you sort them on an **Eisenhower Matrix**, and
carries them into a **Todo** list and a **Pomodoro** timer.

The name is a pun: in Egyptian Arabic *"فضّي دماغك"* means *"dump your brain"* —
and *فضّي* can also mean *silver*.

Built with [Tauri 2](https://tauri.app) (Rust + WebView), a vanilla
TypeScript/Vite frontend, and [LangChain.js](https://js.langchain.com) for
multi-provider LLM support.

## Features

- **Brain dump → tasks** — paste freeform thoughts, get a clean, de-duplicated,
  verb-first task list extracted by your chosen LLM.
- **Eisenhower Matrix** — drag tasks into *Do First / Schedule / Delegate /
  Eliminate*; export to Markdown (Obsidian-friendly) or push into the Todo list.
- **Todo** — persistent checklist with quadrant badges; send any item to the
  Pomodoro timer.
- **Pomodoro** — focus / short / long break cycles with configurable durations
  and an automatic long-break interval.
- **Multiple LLM providers** — Anthropic (Claude), OpenAI, Google Gemini, and
  local Ollama. Switch in Settings.
- **Local config file** — your provider choice, model, and API keys are stored
  in a plain JSON config file on your machine (never bundled, never uploaded
  anywhere except the provider you call).

## Where your data lives

| File            | Location (macOS)                                                        | Contents                          |
| --------------- | ----------------------------------------------------------------------- | --------------------------------- |
| `settings.json` | `~/Library/Application Support/com.silverbrain.app/` (app **config** dir) | provider, model, API keys         |
| `data.json`     | same app **data** dir                                                   | dump text, tasks, matrix, todos, pomodoro stats |

On Linux/Windows these resolve to the platform's standard config/data dirs.

## How LLM calls work

LLM requests are made from the frontend via LangChain, but routed through Tauri's
HTTP plugin (`@tauri-apps/plugin-http`). That proxies the request through the Rust
process, which sidesteps the WebView's CORS restrictions — so you can call
provider APIs directly with a key read from the local config file.

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
index.html              # app shell (3 views: brain dump, todo, pomodoro)
src/
  main.ts               # bootstrap, tab nav, settings modal
  config.ts             # settings/data file persistence (Tauri fs)
  store.ts              # in-memory state + debounced save
  llm.ts                # LangChain multi-provider + task extraction
  views/
    braindump.ts        # brain dump + Eisenhower matrix
    todo.ts             # todo list
    pomodoro.ts         # pomodoro timer
src-tauri/              # Rust host (fs + http plugins)
```
