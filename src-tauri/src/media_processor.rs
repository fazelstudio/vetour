/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  media_processor.rs
 *  Audio and video conversion using the managed FFmpeg binary.
 *-----------------------------------------------------------------------------------------------*/

use serde::Deserialize;
use std::path::Path;
use tauri::AppHandle;

use crate::ffmpeg_manager;

/// Clamp a value into an inclusive range.
fn clamp_u32(value: u32, min: u32, max: u32) -> u32 {
    value.clamp(min, max)
}

/// Allowed x264 presets, fastest to slowest.
fn normalize_preset(raw: Option<String>) -> String {
    const ALLOWED: [&str; 10] = [
        "ultrafast",
        "superfast",
        "veryfast",
        "faster",
        "fast",
        "medium",
        "slow",
        "slower",
        "veryslow",
        "placebo",
    ];
    match raw {
        Some(p) if ALLOWED.contains(&p.as_str()) => p,
        _ => "medium".to_string(),
    }
}

async fn run_ffmpeg(ffmpeg: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    tokio::process::Command::new(ffmpeg)
        .args(args)
        .output()
        .await
        .map_err(|e| format!("Failed to launch FFmpeg: {}", e))
}

fn is_compressed_audio(ext: &str) -> bool {
    matches!(ext, "mp3" | "ogg" | "m4a" | "aac" | "flac" | "wma" | "opus")
}

#[tauri::command]
pub async fn convert_audio(
    app: AppHandle,
    source_path: String,
    output_dir: String,
    bitrate_kbps: Option<u32>,
) -> Result<String, String> {
    let ext = Path::new(&source_path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .unwrap_or_default();

    if is_compressed_audio(&ext) || ext != "wav" {
        return Ok(source_path);
    }

    // Default 192k matches the previous fixed behavior.
    let bitrate = clamp_u32(bitrate_kbps.unwrap_or(192), 64, 320);
    let bitrate_arg = format!("{}k", bitrate);

    let stem = Path::new(&source_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("audio");

    let out_dir = Path::new(&output_dir);
    std::fs::create_dir_all(out_dir).map_err(|e| format!("Failed to create output dir: {}", e))?;

    let output_path = out_dir.join(format!("{}.mp3", stem));
    let output_str = output_path.to_string_lossy().to_string();

    let (ffmpeg, _) = ffmpeg_manager::resolve_ffmpeg_binary(&app)?;
    let result = run_ffmpeg(
        &ffmpeg,
        &[
            "-y",
            "-i",
            &source_path,
            "-c:a",
            "libmp3lame",
            "-b:a",
            &bitrate_arg,
            &output_str,
        ],
    )
    .await?;

    if result.status.success() {
        Ok(output_str)
    } else {
        let stderr = String::from_utf8_lossy(&result.stderr);
        Err(format!("Audio conversion failed: {}", stderr))
    }
}

/// Optional encoder controls for video conversion.
/// Every field falls back to the previous fixed behavior when omitted.
#[derive(Deserialize, Default)]
pub struct VideoConvertOptions {
    #[serde(default)]
    pub crf: Option<u8>,
    #[serde(default)]
    pub max_width: Option<u32>,
    #[serde(default)]
    pub preset: Option<String>,
    #[serde(default)]
    pub audio_bitrate_kbps: Option<u32>,
    #[serde(default)]
    pub faststart: Option<bool>,
}

#[tauri::command]
pub async fn convert_video(
    app: AppHandle,
    source_path: String,
    output_dir: String,
    options: Option<VideoConvertOptions>,
) -> Result<String, String> {
    let options = options.unwrap_or_default();
    // Defaults preserve the previous fixed behavior.
    let crf = (options.crf.unwrap_or(23) as u32).clamp(16, 34).to_string();
    let max_width = clamp_u32(options.max_width.unwrap_or(1920), 640, 3840).to_string();
    let preset = normalize_preset(options.preset);
    let audio_bitrate = format!(
        "{}k",
        clamp_u32(options.audio_bitrate_kbps.unwrap_or(128), 64, 320)
    );
    let scale = format!("scale='min({},iw)':-2", max_width);

    let stem = Path::new(&source_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("video");

    let out_dir = Path::new(&output_dir);
    std::fs::create_dir_all(out_dir).map_err(|e| format!("Failed to create output dir: {}", e))?;

    let output_path = out_dir.join(format!("{}_compressed.mp4", stem));
    let output_str = output_path.to_string_lossy().to_string();

    let (ffmpeg, _) = ffmpeg_manager::resolve_ffmpeg_binary(&app)?;
    let args = vec![
        "-y".to_string(),
        "-i".to_string(),
        source_path.clone(),
        "-vf".to_string(),
        scale,
        "-c:v".to_string(),
        "libx264".to_string(),
        "-crf".to_string(),
        crf,
        "-preset".to_string(),
        preset,
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        audio_bitrate,
    ];
    let mut args = args;
    if options.faststart.unwrap_or(true) {
        args.push("-movflags".to_string());
        args.push("+faststart".to_string());
    }
    args.push(output_str.clone());
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let result = run_ffmpeg(&ffmpeg, &arg_refs).await?;

    if result.status.success() {
        Ok(output_str)
    } else {
        let stderr = String::from_utf8_lossy(&result.stderr);
        Err(format!("Video conversion failed: {}", stderr))
    }
}
