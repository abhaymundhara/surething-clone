let isTauri = false;
try {
  isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
} catch { /* browser mode */ }

// Update system tray badge with pending task count
export async function updateTrayBadge(count: number): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('update_tray_badge', { count });
  } catch (e) {
    console.warn('[Native] Tray badge update failed:', e);
  }
}

// Show native OS notification
export async function showNativeNotification(title: string, body: string): Promise<void> {
  if (!isTauri) {
    // Fallback to Web Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') new Notification(title, { body });
    }
    return;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('show_notification', { title, body });
  } catch (e) {
    console.warn('[Native] Notification failed:', e);
  }
}
