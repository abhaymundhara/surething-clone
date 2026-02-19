import { invoke } from '@tauri-apps/api/core';

// ═══════════════════════════════════════════════════════
// NATIVE BRIDGE — Tauri command invocations
// System tray badge + OS notifications
// ═══════════════════════════════════════════════════════

let isTauri = false;
try {
  isTauri = !!(window as any).__TAURI_INTERNALS__;
} catch { /* browser mode */ }

// Update system tray badge with pending task count
export async function updateTrayBadge(count: number): Promise<void> {
  if (!isTauri) return;
  try {
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
      new Notification(title, { body, icon: '/icon.png' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') new Notification(title, { body, icon: '/icon.png' });
    }
    return;
  }
  try {
    await invoke('show_notification', { title, body });
  } catch (e) {
    console.warn('[Native] Notification failed:', e);
  }
}
