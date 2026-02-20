// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

#[tauri::command]
fn update_tray_badge(app: tauri::AppHandle, count: u32) -> Result<(), String> {
    let tray = app.tray_by_id("main-tray").ok_or("Tray not found")?;
    let tooltip = if count > 0 {
        format!("SureThing Clone — {} pending", count)
    } else {
        "SureThing Clone".to_string()
    };
    tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;

    // On macOS, set the badge text on the dock icon
    #[cfg(target_os = "macos")]
    {
        if count > 0 {
            let _ = app.set_badge_label(Some(count.to_string()));
        } else {
            let _ = app.set_badge_label(None::<String>);
        }
    }
    Ok(())
}

#[tauri::command]
fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            update_tray_badge,
            show_notification,
        ])
        .setup(|app| {
            // Build tray menu using Tauri 2 builder API
            let show_item = MenuItemBuilder::with_id("show", "Show Window").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .separator()
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("SureThing Clone")
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
