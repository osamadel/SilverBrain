// Config + data persistence backed by local files via the Tauri fs plugin.
// - settings.json  → provider / model / API keys / extraction prompt (app config dir)
// - data.json      → brain-dump sessions, pomodoro stats (app data dir)
import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
  BaseDirectory,
} from "@tauri-apps/plugin-fs";
import { appConfigDir, appDataDir, join } from "@tauri-apps/api/path";
import type { NotificationSoundId } from "./notification-sounds";

export type ProviderId = "anthropic" | "openai" | "google" | "ollama";

export interface ProviderSettings {
  model: string;
  apiKey: string;
  baseUrl?: string; // used by ollama (and optionally openai-compatible endpoints)
}

export type AppLanguage = 'en' | 'ar';

export interface AppSettings {
  provider: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  language: AppLanguage;
  /** User-customised task-extraction prompt. Empty/undefined → use the default. */
  extractionPrompt?: string;
  /**
   * Tasks page ordering for completed items: `true` (default) sinks done tasks
   * to the bottom of their quadrant; `false` keeps them where they sit.
   */
  completedToBottom: boolean;
  /** When false, the global double-Ctrl quick-add shortcut is disabled. */
  quickAddEnabled: boolean;
}

export interface PomodoroSettings {
  focus: number;
  short: number;
  long: number;
  interval: number;
  autoStartShort: boolean;
  autoStartLong: boolean;
  soundFocus: NotificationSoundId;
  soundShortBreak: NotificationSoundId;
  soundLongBreak: NotificationSoundId;
}

export type Quadrant = "q1" | "q2" | "q3" | "q4";

/**
 * A single task inside a brain-dump session. `quadrant === ""` means the task
 * is unsorted (lives in the Sort drawer); otherwise it sits in that quadrant.
 * `done` drives the Tasks-page checklist.
 */
export interface SessionTask {
  id: string;
  text: string;
  quadrant: Quadrant | "";
  /** Model's initial quadrant guess at extraction; unchanged when the user re-sorts. */
  suggestedQuadrant?: Quadrant | "";
  done: boolean;
}

/**
 * One brain-dump session: the raw dump plus the unified task list it produced.
 * Sessions are the single source of truth for tasks across the Sort and Tasks
 * pages and accumulate as history.
 */
export interface BrainDumpSession {
  id: string;
  title: string;
  summary: string;
  createdAt: number; // epoch ms
  dump: string;
  tasks: SessionTask[];
}

export interface AppData {
  sessions: BrainDumpSession[];
  activeSessionId: string | null;
  /** In-progress brain-dump text on the Brain Dump page (scratch, pre-extraction). */
  draftDump: string;
  pomodoro: PomodoroSettings;
  focusSessions: number;
}

const SETTINGS_FILE = "settings.json";
const DATA_FILE = "data.json";
export const MEMORY_FILE = "memory.md";

export const DEFAULT_SETTINGS: AppSettings = {
  provider: "anthropic",
  providers: {
    anthropic: { model: "claude-sonnet-4-20250514", apiKey: "" },
    openai: { model: "gpt-4o-mini", apiKey: "" },
    google: { model: "gemini-1.5-flash", apiKey: "" },
    ollama: { model: "llama3.1", apiKey: "", baseUrl: "http://localhost:11434" },
  },
  language: "en",
  completedToBottom: true,
  quickAddEnabled: true,
};

export const DEFAULT_DATA: AppData = {
  sessions: [],
  activeSessionId: null,
  draftDump: "",
  pomodoro: {
    focus: 25,
    short: 5,
    long: 15,
    interval: 4,
    autoStartShort: false,
    autoStartLong: false,
    soundFocus: "digital",
    soundShortBreak: "digital",
    soundLongBreak: "digital",
  },
  focusSessions: 0,
};

/** Short, collision-resistant id used for sessions and tasks. */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// We resolve absolute paths under the app config/data dirs (allowed by the
// fs:scope in capabilities/default.json) rather than relying on a base-dir +
// empty-path mkdir, which behaves inconsistently across platforms.
async function pathFor(base: BaseDirectory.AppConfig | BaseDirectory.AppData, file: string) {
  const dir = base === BaseDirectory.AppConfig ? await appConfigDir() : await appDataDir();
  return { dir, full: await join(dir, file) };
}

async function readJson<T>(
  base: BaseDirectory.AppConfig | BaseDirectory.AppData,
  file: string,
  fallback: T,
): Promise<T> {
  try {
    const { full } = await pathFor(base, file);
    if (!(await exists(full))) return structuredClone(fallback);
    const raw = await readTextFile(full);
    return { ...structuredClone(fallback), ...JSON.parse(raw) } as T;
  } catch (e) {
    console.error(`Failed to read ${file}:`, e);
    return structuredClone(fallback);
  }
}

async function writeJson(
  base: BaseDirectory.AppConfig | BaseDirectory.AppData,
  file: string,
  value: unknown,
) {
  const { dir, full } = await pathFor(base, file);
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  await writeTextFile(full, JSON.stringify(value, null, 2));
}

export async function loadSettings(): Promise<AppSettings> {
  const s = await readJson<AppSettings>(BaseDirectory.AppConfig, SETTINGS_FILE, DEFAULT_SETTINGS);
  // Merge per-provider defaults so newly added providers always exist.
  s.providers = { ...structuredClone(DEFAULT_SETTINGS.providers), ...s.providers };
  return s;
}

export function saveSettings(settings: AppSettings): Promise<void> {
  return writeJson(BaseDirectory.AppConfig, SETTINGS_FILE, settings);
}

// ── Legacy migration ──────────────────────────────────────────────────────────
// Pre-sessions data.json was flat: { dump, tasks[], matrix, todos[], ... }.
// We fold it into a single session so upgrading users keep their work.
interface LegacyTodo { text?: string; quadrant?: Quadrant | ""; done?: boolean }
interface LegacyData {
  dump?: string;
  tasks?: string[];
  matrix?: Partial<Record<Quadrant, string[]>>;
  todos?: LegacyTodo[];
}

function migrateLegacy(legacy: LegacyData): BrainDumpSession | null {
  const dump = typeof legacy.dump === "string" ? legacy.dump : "";
  const tasks: SessionTask[] = [];
  const seen = new Set<string>();
  const push = (text: string, quadrant: Quadrant | "", done: boolean) => {
    const key = text.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    tasks.push({ id: uid(), text, quadrant, done });
  };

  const matrix = legacy.matrix ?? {};
  const placed = new Set<string>();
  for (const q of ["q1", "q2", "q3", "q4"] as Quadrant[]) {
    for (const text of matrix[q] ?? []) {
      placed.add(text.trim().toLowerCase());
      push(text, q, false);
    }
  }
  for (const text of legacy.tasks ?? []) {
    if (!placed.has(text.trim().toLowerCase())) push(text, "", false);
  }
  for (const todo of legacy.todos ?? []) {
    if (typeof todo?.text === "string") push(todo.text, todo.quadrant ?? "", !!todo.done);
  }

  if (!dump.trim() && !tasks.length) return null;

  const firstLine = dump.split("\n").map((l) => l.trim()).find(Boolean) ?? "Imported session";
  return {
    id: uid(),
    title: firstLine.split(/\s+/).slice(0, 6).join(" ").slice(0, 60) || "Imported session",
    summary: dump.replace(/\s+/g, " ").trim().slice(0, 100),
    createdAt: Date.now(),
    dump,
    tasks,
  };
}

export async function loadData(): Promise<AppData> {
  try {
    const { full } = await pathFor(BaseDirectory.AppData, DATA_FILE);
    if (!(await exists(full))) return structuredClone(DEFAULT_DATA);
    const parsed = JSON.parse(await readTextFile(full));

    // Already on the session model → merge defaults for any missing scalars.
    if (Array.isArray(parsed?.sessions)) {
      return {
        ...structuredClone(DEFAULT_DATA),
        ...parsed,
        pomodoro: { ...DEFAULT_DATA.pomodoro, ...(parsed?.pomodoro ?? {}) },
      } as AppData;
    }

    // Legacy shape → migrate into a single session.
    const session = migrateLegacy(parsed as LegacyData);
    const base: AppData = {
      ...structuredClone(DEFAULT_DATA),
      pomodoro: { ...DEFAULT_DATA.pomodoro, ...(parsed?.pomodoro ?? {}) },
      focusSessions: typeof parsed?.focusSessions === "number" ? parsed.focusSessions : 0,
    };
    if (session) {
      base.sessions = [session];
      base.activeSessionId = session.id;
      base.draftDump = session.dump;
    }
    return base;
  } catch (e) {
    console.error(`Failed to read ${DATA_FILE}:`, e);
    return structuredClone(DEFAULT_DATA);
  }
}

export function saveData(data: AppData): Promise<void> {
  return writeJson(BaseDirectory.AppData, DATA_FILE, data);
}

/** Learned Eisenhower urgency/importance heuristics (markdown). Empty when missing. */
export async function loadMemory(): Promise<string> {
  try {
    const { full } = await pathFor(BaseDirectory.AppData, MEMORY_FILE);
    if (!(await exists(full))) return "";
    return await readTextFile(full);
  } catch (e) {
    console.error(`Failed to read ${MEMORY_FILE}:`, e);
    return "";
  }
}

export async function saveMemory(content: string): Promise<void> {
  const { dir, full } = await pathFor(BaseDirectory.AppData, MEMORY_FILE);
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  await writeTextFile(full, content.trim() + "\n");
}
