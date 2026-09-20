/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  lib.rs
 *  Tauri application entry with window setup and command registration.
 *-----------------------------------------------------------------------------------------------*/

mod ffmpeg_manager;
mod file_lock;
mod image_processor;
mod media_processor;

use std::sync::Mutex;
use tauri::{Manager, State};

pub struct PresentData(Mutex<Option<String>>);

/// Minimum window size as a ratio of the current monitor size.
/// The main window can never be resized smaller than this.
const MIN_WINDOW_RATIO: f64 = 0.6;

/*
Set the 60%-of-screen minimum size on the window once.
The OS enforces this limit natively on every resize and restore-down
without any manual Resized-event handler.
*/
fn apply_min_window_size(window: &tauri::WebviewWindow) {
    let monitor = match window.current_monitor() {
        Ok(Some(monitor)) => monitor,
        _ => return,
    };
    let monitor_size = monitor.size();
    let min_w = (monitor_size.width as f64 * MIN_WINDOW_RATIO).floor() as u32;
    let min_h = (monitor_size.height as f64 * MIN_WINDOW_RATIO).floor() as u32;
    let _ = window.set_min_size(Some(tauri::Size::Physical(tauri::PhysicalSize {
        width: min_w,
        height: min_h,
    })));
}

#[tauri::command]
fn store_present_data(data: String, state: State<'_, PresentData>) {
    *state.0.lock().unwrap() = Some(data);
}

#[tauri::command]
fn get_present_data(state: State<'_, PresentData>) -> Option<String> {
    state.0.lock().unwrap().clone()
}

#[tauri::command]
fn clear_present_data(state: State<'_, PresentData>) {
    *state.0.lock().unwrap() = None;
}

/*
Called by the frontend once the first themed frame is fully painted.
Sequence: apply OS-level min size → show → maximize → focus.
show() must come before maximize() because maximize() is a no-op on
hidden windows on Windows/WebView2.
Both show() and maximize() are sent synchronously in the same IPC call,
so WebView2 cannot composite a non-maximized frame between them.
*/
#[tauri::command]
fn show_main_window(window: tauri::WebviewWindow) {
    // Register the OS-enforced minimum before revealing.
    apply_min_window_size(&window);
    // Reveal the window.
    let _ = window.show();
    // Maximize immediately — the OS will paint the first frame already full-screen.
    let _ = window.maximize();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_snap_layout::init()
                .button_id("titlebar-maximize")
                .cursor(tauri_plugin_snap_layout::SnapCursor::Hand)
                .build()
        )
        .manage(file_lock::FileLockState::default())
        .manage(ffmpeg_manager::FfmpegState::default())
        .manage(PresentData(Mutex::new(None)))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(desktop)]
                {
                    let icon_bytes = include_bytes!("../icons/icon-tast.png");
                    if let Ok(img) = image::load_from_memory(icon_bytes) {
                        let rgba = img.into_rgba8();
                        let width = rgba.width();
                        let height = rgba.height();
                        let tauri_image =
                            tauri::image::Image::new_owned(rgba.into_raw(), width, height);
                        let _ = window.set_icon(tauri_image);
                    }
                }

                /*
                Apply the minimum size once during setup so the OS limit is
                active even before show_main_window is called from JS.
                No Resized event handler is used — manually calling set_size()
                inside a Resized handler races against the OS maximize/restore
                animation and causes the window to flicker or snap back.
                */
                apply_min_window_size(&window);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            store_present_data,
            get_present_data,
            clear_present_data,
            image_processor::process_panorama,
            media_processor::convert_audio,
            media_processor::convert_video,
            ffmpeg_manager::get_ffmpeg_status,
            ffmpeg_manager::get_ffmpeg_asset_info,
            ffmpeg_manager::check_ffmpeg_connection,
            ffmpeg_manager::download_ffmpeg,
            ffmpeg_manager::import_local_ffmpeg,
            ffmpeg_manager::cancel_ffmpeg_download,
            ffmpeg_manager::delete_ffmpeg,
            file_lock::lock_project_file,
            file_lock::unlock_project_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
