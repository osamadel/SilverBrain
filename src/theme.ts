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
 * - `storage` fires in *other* windows when the preference changes, so the
 *   popover follows the main window live.
 * - the media query fires when the OS appearance flips while in system mode.
 * `onChange` lets callers refresh dependent UI (e.g. seg-button state).
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
