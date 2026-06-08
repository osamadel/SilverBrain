import "./style.css";
import { applyLanguage, t } from "./i18n";
import { store } from "./store";
import type { Lang } from "./i18n";
import {
  listenTrayState,
  sendTrayCmd,
  hideTrayPopover,
  type PomodoroState,
} from "./tray";
import { applyEffectiveTheme, initThemeSync } from "./theme";

function format(sec: number): string {
  const mm = Math.floor(sec / 60).toString().padStart(2, "0");
  const ss = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function render(state: PomodoroState) {
  document.getElementById("trayPomoTime")!.textContent = format(state.remaining);
  document.getElementById("trayPomoToggle")!.textContent = state.running
    ? t("btn-pomo-pause")
    : t("btn-pomo-start");

  const taskEl = document.getElementById("trayPomoTask")!;
  taskEl.textContent = state.taskText
    ? `${t("pomo-focusing-on")}: ${state.taskText}`
    : t("pomo-no-task");

  document.querySelectorAll("#trayPomoModes .tray-pomo-mode").forEach((b) => {
    b.classList.toggle("active", (b as HTMLElement).dataset.mode === state.mode);
  });
}

async function main() {
  // Match the main app's theme (incl. "system"), and follow it live: the main
  // window's preference changes reach us via the storage event, OS appearance
  // flips via the media query.
  applyEffectiveTheme();
  initThemeSync();

  if ("__TAURI_INTERNALS__" in window) {
    try {
      const { Effect, getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      await win.setShadow(false);
      await win.setBackgroundColor({ red: 0, green: 0, blue: 0, alpha: 0 });
      await win.setEffects({
        effects: [Effect.WindowBackground],
        radius: 12,
      });
    } catch (e) {
      console.warn("popover window configure failed:", e);
    }
  }

  await store.init();
  applyLanguage((store.settings.language ?? "en") as Lang);

  const closeBtn = document.getElementById("trayPomoClose")!;
  closeBtn.setAttribute("aria-label", t("btn-close"));
  closeBtn.setAttribute("title", t("btn-close"));

  document.querySelectorAll("#trayPomoModes .tray-pomo-mode").forEach((b) => {
    (b as HTMLElement).onclick = () =>
      void sendTrayCmd({ action: "setMode", mode: (b as HTMLElement).dataset.mode as "focus" | "short" | "long" });
  });
  document.getElementById("trayPomoToggle")!.onclick = () => void sendTrayCmd({ action: "toggle" });
  document.getElementById("trayPomoSkip")!.onclick = () => void sendTrayCmd({ action: "skip" });
  document.getElementById("trayPomoClose")!.onclick = () => void hideTrayPopover();

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      void hideTrayPopover();
    }
  });

  await listenTrayState(render);
}

main().catch(console.error);
