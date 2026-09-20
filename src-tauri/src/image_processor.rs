/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  image_processor.rs
 *  Panorama resizing and WebP encoding with progress events.
 *-----------------------------------------------------------------------------------------------*/

use image::imageops::FilterType;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use std::path::Path;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Deserialize, Clone)]
pub struct ProcessProgress {
    pub scene_id: String,
    pub status: String,
    pub progress: u8,
    pub resolutions: Option<Vec<ResolutionPath>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ResolutionPath {
    pub label: String,
    pub path: String,
}

#[tauri::command]
pub async fn process_panorama(
    app: AppHandle,
    scene_id: String,
    source_path: String,
    output_dir: String,
    quality: Option<f32>,
    max_width: Option<u32>,
) -> Result<Vec<ResolutionPath>, String> {
    let scene_id_clone = scene_id.clone();

    // Defaults preserve the previous fixed behavior.
    let quality = quality.unwrap_or(80f32).clamp(10f32, 100f32);
    let max_width = max_width.unwrap_or(4096).clamp(1024, 8192);

    let result = tauri::async_runtime::spawn_blocking(move || {
        let emit_progress = |status: &str, progress: u8| {
            let _ = app.emit(
                "process_progress",
                ProcessProgress {
                    scene_id: scene_id_clone.clone(),
                    status: status.to_string(),
                    progress,
                    resolutions: None,
                },
            );
        };

        emit_progress("Loading image...", 10);
        let img = match image::open(&source_path) {
            Ok(i) => i,
            Err(e) => return Err(format!("Failed to open image: {}", e)),
        };

        emit_progress("Resizing image...", 40);

        let target_width = max_width;
        let aspect_ratio = img.height() as f32 / img.width() as f32;
        let target_height = (target_width as f32 * aspect_ratio) as u32;

        let resized = if img.width() > target_width {
            img.resize_exact(target_width, target_height, FilterType::CatmullRom)
        } else {
            img.clone()
        };

        emit_progress("Encoding WebP...", 70);

        let out_filename = format!("{}_high.webp", scene_id_clone);
        let out_path = Path::new(&output_dir).join(&out_filename);

        if let Some(parent) = out_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let mut file = match File::create(&out_path) {
            Ok(f) => f,
            Err(e) => return Err(format!("Failed to create output file: {}", e)),
        };

        let encoded = webp::Encoder::from_image(&resized)
            .map_err(|e| format!("Failed to create WebP encoder: {}", e))?
            .encode(quality);
        file.write_all(&encoded)
            .map_err(|e| format!("Failed to write WebP: {}", e))?;

        emit_progress("Complete", 100);

        let output_paths = vec![ResolutionPath {
            label: "high".to_string(),
            path: out_path.to_string_lossy().to_string(),
        }];

        Ok(output_paths)
    })
    .await;

    match result {
        Ok(res) => res,
        Err(e) => Err(format!("Task failed: {}", e)),
    }
}
