// macOS menu-bar tray bridge (Tauri only). Main window syncs timer state; popover
// window listens and sends commands back.

export type PomodoroMode = "focus" | "short" | "long";

export interface PomodoroState {
  remaining: number;
  running: boolean;
  mode: PomodoroMode;
  taskText: string;
  focusSessions: number;
}

export type PomodoroCmd =
  | { action: "toggle" }
  | { action: "skip" }
  | { action: "fullReset" }
  | { action: "setMode"; mode: PomodoroMode };

export const POMO_STATE_EVENT = "pomodoro:state";
export const POMO_CMD_EVENT = "pomodoro:cmd";

function isMacTauri(): boolean {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return false;
  return /Mac|iP(hone|ad|od)/.test(navigator.platform);
}

let trayActive = false;
let pillCanvas: HTMLCanvasElement | null = null;
let lastPillKey = "";

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return import("@tauri-apps/api/core").then(({ invoke: inv }) => inv<T>(cmd, args));
}

export function isTraySupported(): boolean {
  return isMacTauri();
}

export async function hideMainWindow(): Promise<void> {
  if (!isMacTauri()) return;
  try {
    await invoke("hide_main_window");
  } catch (e) {
    console.warn("hide_main_window failed:", e);
  }
}

export async function showMainWindow(): Promise<void> {
  if (!isMacTauri()) return;
  try {
    await invoke("show_main_window");
  } catch (e) {
    console.warn("show_main_window failed:", e);
  }
}

function formatTrayTitle(remaining: number): string {
  const mm = Math.floor(remaining / 60).toString().padStart(2, "0");
  const ss = Math.floor(remaining % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Pill (stadium) outline: rounded rect with fully semicircular ends. */
function pillPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.closePath();
}

/** Render the menu-bar pill: transparent fill, stroke outline + timer text. */
async function renderTrayPill(remaining: number): Promise<Uint8Array> {
  if (!pillCanvas) pillCanvas = document.createElement("canvas");

  const scale = 2;
  const fontSize = 16;
  const paddingX = 9;
  const paddingY = 3;
  const h = fontSize + paddingY * 2;
  const font = `800 ${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
  const label = formatTrayTitle(remaining);

  pillCanvas.width = 1;
  pillCanvas.height = 1;
  const measureCtx = pillCanvas.getContext("2d")!;
  measureCtx.font = font;
  const w = Math.ceil(measureCtx.measureText(label).width + paddingX * 2);

  pillCanvas.width = w * scale;
  pillCanvas.height = h * scale;
  const ctx = pillCanvas.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Black on transparent — macOS template mode tints for light/dark menu bar.
  pillPath(ctx, 1, 1, w - 2, h - 2);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1.75;
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, w / 2, h / 2 + 0.5);

  const blob = await new Promise<Blob>((resolve, reject) => {
    pillCanvas!.toBlob((b) => (b ? resolve(b) : reject(new Error("pill toBlob failed"))), "image/png");
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function setTrayPill(remaining: number): Promise<void> {
  if (!isMacTauri()) return;
  const key = formatTrayTitle(remaining);
  if (key === lastPillKey) return;
  lastPillKey = key;
  try {
    const pngBytes = await renderTrayPill(remaining);
    await invoke("set_tray_pill", { pngBytes: Array.from(pngBytes) });
  } catch (e) {
    console.warn("set_tray_pill failed:", e);
  }
}

export async function setTrayVisible(visible: boolean): Promise<void> {
  if (!isMacTauri()) return;
  trayActive = visible;
  lastPillKey = "";
  try {
    await invoke("set_tray_visible", { visible });
  } catch (e) {
    console.warn("set_tray_visible failed:", e);
  }
}

/** Push timer state to the tray pill and popover window (main window only). */
export async function syncTrayState(state: PomodoroState): Promise<void> {
  if (!isMacTauri()) return;

  const { emit } = await import("@tauri-apps/api/event");
  await emit(POMO_STATE_EVENT, state);

  if (!trayActive) return;
  await setTrayPill(state.remaining);
}

/** Activate tray on first focus start — render pill before showing to avoid app-icon flash. */
export async function activateTray(remaining: number): Promise<void> {
  if (!isMacTauri() || trayActive) return;
  trayActive = true;
  lastPillKey = "";
  await setTrayPill(remaining);
  try {
    await invoke("set_tray_visible", { visible: true });
  } catch (e) {
    console.warn("set_tray_visible failed:", e);
  }
}

/** Clear tray and restore main window (full reset). */
export async function deactivateTray(): Promise<void> {
  if (!isMacTauri()) return;
  trayActive = false;
  lastPillKey = "";
  await setTrayVisible(false);
  await showMainWindow();
}

/** Hide the tray popover window (popover window only). */
export async function hideTrayPopover(): Promise<void> {
  if (!isMacTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch (e) {
    console.warn("hide_tray_popover failed:", e);
  }
}

/** Main window: listen for popover commands. */
export async function initTrayBridge(onCmd: (cmd: PomodoroCmd) => void): Promise<void> {
  if (!isMacTauri()) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<PomodoroCmd>(POMO_CMD_EVENT, (ev) => onCmd(ev.payload));
}

/** Popover window: listen for state updates from main. */
export async function listenTrayState(onState: (state: PomodoroState) => void): Promise<void> {
  if (!isMacTauri()) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<PomodoroState>(POMO_STATE_EVENT, (ev) => onState(ev.payload));
}

/** Popover window: send a command to the main window. */
export async function sendTrayCmd(cmd: PomodoroCmd): Promise<void> {
  if (!isMacTauri()) return;
  const { emit } = await import("@tauri-apps/api/event");
  await emit(POMO_CMD_EVENT, cmd);
}
