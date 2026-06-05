// Tiny shared state holder. Loaded once at startup; mutated in place by views.
// Persistence is debounced so rapid edits (typing, dragging) don't thrash disk.
import {
  loadSettings,
  loadData,
  saveSettings,
  saveData,
  uid,
  type AppSettings,
  type AppData,
  type BrainDumpSession,
} from "./config";

class Store {
  settings!: AppSettings;
  data!: AppData;

  private dataTimer: number | null = null;

  async init() {
    [this.settings, this.data] = await Promise.all([loadSettings(), loadData()]);
  }

  /** The currently-open session, or null when none has been created yet. */
  activeSession(): BrainDumpSession | null {
    const id = this.data.activeSessionId;
    if (!id) return null;
    return this.data.sessions.find((s) => s.id === id) ?? null;
  }

  /** Create a new session, prepend it (newest-first) and make it active. */
  createSession(fields: Partial<Omit<BrainDumpSession, "id" | "createdAt">> = {}): BrainDumpSession {
    const session: BrainDumpSession = {
      id: uid(),
      createdAt: Date.now(),
      title: fields.title ?? "Untitled",
      summary: fields.summary ?? "",
      dump: fields.dump ?? "",
      tasks: fields.tasks ?? [],
    };
    this.data.sessions.unshift(session);
    this.data.activeSessionId = session.id;
    return session;
  }

  /** Return the active session, lazily creating an empty one if none exists. */
  ensureActiveSession(): BrainDumpSession {
    return this.activeSession() ?? this.createSession({ title: "Quick tasks" });
  }

  /** Persist settings immediately (called on explicit Save). */
  persistSettings() {
    return saveSettings(this.settings);
  }

  /** Persist app data, debounced. */
  persistData() {
    if (this.dataTimer !== null) clearTimeout(this.dataTimer);
    this.dataTimer = window.setTimeout(() => {
      saveData(this.data).catch((e) => console.error("Failed to save data:", e));
      this.dataTimer = null;
    }, 400);
  }
}

export const store = new Store();
