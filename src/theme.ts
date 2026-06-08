// Centralised theme handling shared by the main window and the tray popover.
// A *preference* (light/dark/system) is persisted to localStorage; the
// *effective* theme it resolves to drives the `.light` class on <html>.
// "system" follows the OS appearance via prefers-color-scheme.

export type ThemePref = "light" | "dark" | "system";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "sb-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Persisted preference; defaults to dark when unset or unrecognised. */
export function getThemePref(): ThemePref {
  const v = localStorage.getItem(THEME_STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "dark";
}

export function setThemePref(pref: ThemePref): void {
  localStorage.setItem(THEME_STORAGE_KEY, pref);
}

/** Current OS appearance. */
export function systemTheme(): EffectiveTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light";
}

/** Resolve a preference to the theme actually shown. */
export function effectiveTheme(pref: ThemePref = getThemePref()): EffectiveTheme {
  return pref === "system" ? systemTheme() : pref;
}

/** Toggle the `.light` class to reflect the effective theme. */
export function applyEffectiveTheme(pref: ThemePref = getThemePref()): void {
  document.documentElement.classList.toggle("light", effectiveTheme(pref) === "light");
}

/**
 * Keep this window's theme in sync after the initial apply:
 * - `storage` fires in *other* documents of the same window when the preference
 *   changes (covers same-window updates).
 * - the media query fires when the OS appearance flips while in system mode.
 * `onChange` lets callers refresh dependent UI (e.g. seg-button state).
 *
 * NB: the `storage` event does **not** cross separate Tauri webview windows
 * (WKWebView delivers it per-webview), so auxiliary windows like the tray
 * popover and quick-add overlay must additionally use {@link listenTheme} to
 * follow the main window live. localStorage itself is shared, so the initial
 * {@link applyEffectiveTheme} on load is correct.
 */
export function initThemeSync(onChange?: () => void): void {
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyEffectiveTheme();
      onChange?.();
    }
  });
  window.matchMedia?.(DARK_QUERY).addEventListener("change", () => {
    if (getThemePref() === "system") {
      applyEffectiveTheme();
      onChange?.();
    }
  });
}

// ── Cross-window propagation (Tauri) ────────────────────────────────────────
// The main window owns the theme preference; auxiliary windows can't see its
// live changes through `storage`, so the main window broadcasts the resolved
// effective theme over a Tauri event and the others listen.

const THEME_EVENT = "theme:state";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Main window: announce the effective theme to all other windows. No-op off Tauri. */
export async function broadcastTheme(theme: EffectiveTheme): Promise<void> {
  if (!isTauri()) return;
  try {
    const { emit } = await import("@tauri-apps/api/event");
    await emit(THEME_EVENT, theme);
  } catch (e) {
    console.warn("broadcastTheme failed:", e);
  }
}

/** Auxiliary windows: apply the effective theme whenever the main window broadcasts it. */
export async function listenTheme(onTheme: (theme: EffectiveTheme) => void): Promise<void> {
  if (!isTauri()) return;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<EffectiveTheme>(THEME_EVENT, (e) => onTheme(e.payload));
  } catch (e) {
    console.warn("listenTheme failed:", e);
  }
}
