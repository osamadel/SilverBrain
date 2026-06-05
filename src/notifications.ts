// Native OS notifications (Tauri plugin) with a Web Notifications fallback for browser preview.

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function ensureTauriPermission(): Promise<boolean> {
  const { isPermissionGranted, requestPermission } = await import(
    "@tauri-apps/plugin-notification"
  );
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  return granted;
}

async function ensureWebPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Request notification permission (no-op if already granted or unavailable). */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    return isTauri() ? await ensureTauriPermission() : await ensureWebPermission();
  } catch {
    return false;
  }
}

/** Show a system notification when permission is granted. */
export async function showSystemNotification(title: string, body: string): Promise<void> {
  try {
    if (isTauri()) {
      const granted = await ensureTauriPermission();
      if (!granted) return;
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      sendNotification({ title, body });
      return;
    }

    if (!("Notification" in window)) return;
    const granted = await ensureWebPermission();
    if (granted) new Notification(title, { body });
  } catch {
    /* notifications unavailable — in-app feedback still runs */
  }
}
