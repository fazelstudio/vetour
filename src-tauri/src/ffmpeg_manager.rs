/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ffmpeg_manager.rs
 *  Manages the optional FFmpeg binary used for media optimization.
 *  The installer ships without FFmpeg to keep it small; users can
 *  download it on demand from Settings > Media.
 *-----------------------------------------------------------------------------------------------*/

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Mutex,
};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::AsyncWriteExt;

const SIDECAR_REPO: &str = "fazelstudio/vetour";
const SIDECAR_TAG: &str = "ffmpeg-sidecar-v1";

#[derive(Default)]
pub struct FfmpegState {
    pub downloading: Mutex<bool>,
    pub cancel_requested: AtomicBool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub installed: bool,
    pub path: Option<String>,
    pub size_bytes: Option<u64>,
    pub version: Option<String>,
    pub downloading: bool,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    /// Where the binary was found: app-data, imported, dev-sidecar, bundled, or system.
    pub source: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
}

/// Returns (local file name, release asset name) for the current platform.
/// The mapping follows the running binary, so a download can never mismatch
/// the OS. Some mapped assets may not be published yet (for example macOS
/// ARM64); the download surfaces that with the exact asset name instead.
fn platform_binary() -> Result<(String, String), String> {
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    let asset = match (os, arch) {
        ("windows", "x86_64") => "ffmpeg-x86_64-pc-windows-msvc.exe",
        ("windows", "aarch64") => "ffmpeg-aarch64-pc-windows-msvc.exe",
        ("macos", "x86_64") => "ffmpeg-x86_64-apple-darwin",
        ("macos", "aarch64") => "ffmpeg-aarch64-apple-darwin",
        ("linux", "x86_64") => "ffmpeg-x86_64-unknown-linux-gnu",
        ("linux", "aarch64") => "ffmpeg-aarch64-unknown-linux-gnu",
        _ => return Err(format!("Unsupported platform: {} {}", os, arch)),
    };

    let local = if os == "windows" {
        "ffmpeg.exe".to_string()
    } else {
        "ffmpeg".to_string()
    };

    Ok((local, asset.to_string()))
}

fn download_url(asset: &str) -> String {
    format!(
        "https://github.com/{}/releases/download/{}/{}",
        SIDECAR_REPO, SIDECAR_TAG, asset
    )
}

fn release_page_url() -> String {
    format!(
        "https://github.com/{}/releases/tag/{}",
        SIDECAR_REPO, SIDECAR_TAG
    )
}

/// Marker written next to an imported binary so status can tell
/// user-provided files apart from on-demand downloads.
const IMPORTED_MARKER: &str = ".imported";

fn imported_marker_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(bin_dir(app)?.join(IMPORTED_MARKER))
}

/// Describes which release asset matches this device, if any.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegAssetInfo {
    pub supported: bool,
    pub os: String,
    pub arch: String,
    pub asset: Option<String>,
    pub url: Option<String>,
    pub release_page: String,
    pub reason: Option<String>,
}

/// Report the exact release asset for this device before any download.
/// The UI uses this to show the file name up front and to explain clearly
/// when no binary exists for the platform yet.
#[tauri::command]
pub fn get_ffmpeg_asset_info() -> FfmpegAssetInfo {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    match platform_binary() {
        Ok((_, asset)) => FfmpegAssetInfo {
            supported: true,
            os,
            arch,
            url: Some(download_url(&asset)),
            asset: Some(asset),
            release_page: release_page_url(),
            reason: None,
        },
        Err(reason) => FfmpegAssetInfo {
            supported: false,
            os,
            arch,
            asset: None,
            url: None,
            release_page: release_page_url(),
            reason: Some(reason),
        },
    }
}

/// Run `binary -version` and return the parsed version string.
/// A wrong-architecture file fails here, so it doubles as validation.
fn ffmpeg_version_string(path: &std::path::Path) -> Option<String> {
    let output = std::process::Command::new(path)
        .arg("-version")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().next().map(|l| {
        // Parse "ffmpeg version 7.1 ..." into "7.1".
        let mut parts = l.split_whitespace();
        let _ = parts.next(); // ffmpeg
        let _ = parts.next(); // version
        parts.next().unwrap_or("").to_string()
    })
}

/// Copy a user-provided FFmpeg binary into the app bin dir.
/// The file keeps no name requirement: any name works because the bytes are
/// copied to the canonical local name (ffmpeg.exe on Windows, ffmpeg
/// elsewhere). Validation runs the file, so incompatible builds fail here
/// with a clear message instead of breaking conversions later.
#[tauri::command]
pub async fn import_local_ffmpeg(
    app: AppHandle,
    state: State<'_, FfmpegState>,
    source_path: String,
) -> Result<FfmpegStatus, String> {
    if is_downloading(&state) {
        return Err("A download is in progress. Please cancel it first.".to_string());
    }

    let source = PathBuf::from(&source_path);
    if !source.is_file() {
        return Err(
            "The selected file could not be read. Please pick the FFmpeg binary file itself."
                .to_string(),
        );
    }

    // The file must actually execute as FFmpeg on this machine.
    let version = ffmpeg_version_string(&source).filter(|v| !v.is_empty());
    if version.is_none() {
        return Err("That file does not run as FFmpeg on this device (it may be built for a different system). Please pick another file or use Download.".to_string());
    }

    let dir = bin_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create bin dir: {}", e))?;

    let final_path = ffmpeg_path(&app)?;
    // Remove a previous download or import, including any stale part file.
    if final_path.exists() {
        std::fs::remove_file(&final_path)
            .map_err(|e| format!("Failed to replace the existing FFmpeg binary: {}", e))?;
    }
    let part = part_path(&app)?;
    if part.exists() {
        let _ = std::fs::remove_file(&part);
    }

    std::fs::copy(&source, &final_path)
        .map_err(|e| format!("Failed to copy the FFmpeg binary: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&final_path, std::fs::Permissions::from_mode(0o755));
    }

    // Confirm the installed copy runs after the move.
    if ffmpeg_version_string(&final_path).is_none() {
        let _ = std::fs::remove_file(&final_path);
        return Err("The file could not be installed as FFmpeg on this device. Please try another file or use Download.".to_string());
    }

    // Mark the binary as user-provided so status and delete treat it correctly.
    let marker = imported_marker_path(&app)?;
    let _ = std::fs::write(&marker, version.clone().unwrap_or_default());

    get_ffmpeg_status(app, state)
}

pub fn bin_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
    Ok(data_dir.join("bin"))
}

pub fn ffmpeg_path(app: &AppHandle) -> Result<PathBuf, String> {
    let (local, _) = platform_binary()?;
    Ok(bin_dir(app)?.join(local))
}

/// Source-tree sidecar used during development (bun install downloads it).
/// Only compiled into debug builds, so release binaries never look here.
#[cfg(debug_assertions)]
fn dev_sidecar_path() -> Option<PathBuf> {
    let (_, asset) = platform_binary().ok()?;
    let candidate = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(asset);
    if candidate.exists() {
        Some(candidate)
    } else {
        None
    }
}

/// Resolve the FFmpeg binary, trying each source in order:
/// 1. On-demand download or user-provided import in Settings > Media (app data bin dir).
/// 2. Development sidecar from src-tauri/binaries (debug builds only).
/// 3. Sidecar next to the running executable (bundled builds).
/// 4. System-wide FFmpeg found in PATH.
pub fn resolve_ffmpeg_binary(app: &AppHandle) -> Result<(PathBuf, &'static str), String> {
    if let Ok(path) = ffmpeg_path(app) {
        if path.exists() {
            // A marker means the user provided this file via "Use local file".
            let source = match imported_marker_path(app) {
                Ok(marker) if marker.exists() => "imported",
                _ => "app-data",
            };
            return Ok((path, source));
        }
    }

    #[cfg(debug_assertions)]
    if let Some(path) = dev_sidecar_path() {
        return Ok((path, "dev-sidecar"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for name in ["ffmpeg.exe", "ffmpeg"] {
                let candidate = dir.join(name);
                if candidate.exists() {
                    return Ok((candidate, "bundled"));
                }
            }
        }
    }

    if let Ok(output) = std::process::Command::new("ffmpeg")
        .arg("-version")
        .output()
    {
        if output.status.success() {
            return Ok((PathBuf::from("ffmpeg"), "system"));
        }
    }

    Err("FFmpeg is not installed. Open Settings > Media to install it.".to_string())
}

fn part_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut p = ffmpeg_path(app)?;
    let file_name = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("ffmpeg")
        .to_string();
    p.set_file_name(format!("{}.part", file_name));
    Ok(p)
}

fn is_downloading(state: &State<'_, FfmpegState>) -> bool {
    *state.downloading.lock().unwrap()
}

#[tauri::command]
pub fn get_ffmpeg_status(
    app: AppHandle,
    state: State<'_, FfmpegState>,
) -> Result<FfmpegStatus, String> {
    let downloading = is_downloading(&state);
    let part = part_path(&app)?;
    let downloaded_bytes = std::fs::metadata(&part).map(|m| m.len()).unwrap_or(0);

    if let Ok((path, source)) = resolve_ffmpeg_binary(&app) {
        // The .part file only tracks on-demand downloads, not sidecars.
        let is_managed = source == "app-data" || source == "imported";
        let size = std::fs::metadata(&path).map(|m| m.len()).ok();
        let version = ffmpeg_version_string(&path).filter(|v| !v.is_empty());
        return Ok(FfmpegStatus {
            installed: true,
            path: Some(path.to_string_lossy().to_string()),
            size_bytes: size,
            version,
            downloading,
            downloaded_bytes: if is_managed { downloaded_bytes } else { 0 },
            total_bytes: None,
            source: Some(source.to_string()),
        });
    }

    Ok(FfmpegStatus {
        installed: false,
        path: None,
        size_bytes: None,
        version: None,
        downloading,
        downloaded_bytes,
        total_bytes: None,
        source: None,
    })
}

#[tauri::command]
pub async fn check_ffmpeg_connection() -> Result<bool, String> {
    let (_, asset) = platform_binary()?;
    let url = download_url(&asset);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent("Vetour")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Use a lightweight ranged request to avoid downloading the whole binary.
    let res = client.get(&url).header("Range", "bytes=0-0").send().await;

    match res {
        Ok(resp) => {
            let status = resp.status();
            /*
            A 404 means the asset is not published, not that the network is
            down. Report connected so the download can surface the exact
            missing file name instead of a misleading offline message.
            */
            Ok(status.is_success()
                || status.as_u16() == 206
                || status.as_u16() == 404
                || status.is_redirection())
        }
        Err(e) if e.is_timeout() || e.is_connect() => Ok(false),
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("dns")
                || msg.contains("failed to lookup")
                || msg.contains("Network is unreachable")
                || msg.contains("No connection")
            {
                Ok(false)
            } else {
                Err(format!("Connection check failed: {}", msg))
            }
        }
    }
}

#[tauri::command]
pub async fn cancel_ffmpeg_download(state: State<'_, FfmpegState>) -> Result<(), String> {
    state.cancel_requested.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn delete_ffmpeg(
    app: AppHandle,
    state: State<'_, FfmpegState>,
) -> Result<FfmpegStatus, String> {
    if is_downloading(&state) {
        return Err("A download is in progress. Please cancel it first.".to_string());
    }

    /*
    Only files owned by the app (downloaded or imported) can be deleted.
    Sidecar and system binaries are managed outside the app and must be kept.
    */
    if let Ok((_, source)) = resolve_ffmpeg_binary(&app) {
        if source != "app-data" && source != "imported" {
            return Err(
                "This FFmpeg binary is managed outside the app and cannot be deleted here."
                    .to_string(),
            );
        }
    }

    let path = ffmpeg_path(&app)?;
    let part = part_path(&app)?;

    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete FFmpeg: {}", e))?;
    }
    if part.exists() {
        let _ = std::fs::remove_file(&part);
    }
    if let Ok(marker) = imported_marker_path(&app) {
        let _ = std::fs::remove_file(&marker);
    }

    get_ffmpeg_status(app, state)
}

fn parse_total_bytes(response: &reqwest::Response, resume_from: u64) -> Option<u64> {
    // Prefer the total from Content-Range, for example bytes 100-200/12345.
    if let Some(range) = response.headers().get("content-range") {
        if let Ok(s) = range.to_str() {
            if let Some(total) = s.rsplit('/').next() {
                if let Ok(n) = total.parse::<u64>() {
                    return Some(n);
                }
            }
        }
    }
    // Fall back to Content-Length, including the resume offset for 206 responses.
    response
        .headers()
        .get("content-length")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
        .map(|len| {
            if response.status().as_u16() == 206 {
                resume_from + len
            } else {
                len
            }
        })
}

#[tauri::command]
pub async fn download_ffmpeg(
    app: AppHandle,
    state: State<'_, FfmpegState>,
) -> Result<FfmpegStatus, String> {
    {
        let mut downloading = state.downloading.lock().unwrap();
        if *downloading {
            return Err("A download is already in progress.".to_string());
        }
        *downloading = true;
    }
    state.cancel_requested.store(false, Ordering::SeqCst);

    let result = download_ffmpeg_inner(&app, &state).await;

    {
        let mut downloading = state.downloading.lock().unwrap();
        *downloading = false;
    }

    match result {
        Ok(()) => get_ffmpeg_status(app, state),
        Err(e) => {
            if e == "cancelled" {
                Err("Download cancelled.".to_string())
            } else {
                Err(e)
            }
        }
    }
}

async fn download_ffmpeg_inner(
    app: &AppHandle,
    state: &State<'_, FfmpegState>,
) -> Result<(), String> {
    let (_local, asset) = platform_binary()?;
    let url = download_url(&asset);

    let dir = bin_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Failed to create bin dir: {}", e))?;

    let final_path = ffmpeg_path(app)?;
    if final_path.exists() {
        return Ok(());
    }
    let tmp_path = part_path(app)?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(15))
        .user_agent("Vetour")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let mut last_error = String::new();

    for attempt in 0..4 {
        if state.cancel_requested.load(Ordering::SeqCst) {
            return Err("cancelled".to_string());
        }

        let resume_from = std::fs::metadata(&tmp_path).map(|m| m.len()).unwrap_or(0);

        let mut req = client.get(&url);
        if resume_from > 0 {
            req = req.header("Range", format!("bytes={}-", resume_from));
        }

        let response = match req.send().await {
            Ok(r) => r,
            Err(e) if e.is_timeout() || e.is_connect() || e.is_body() || e.is_decode() => {
                last_error = "Connection interrupted. You can resume the download to continue where it left off.".to_string();
                if attempt < 3 {
                    tokio::time::sleep(std::time::Duration::from_secs(1 << attempt)).await;
                    continue;
                }
                return Err(last_error);
            }
            Err(e) => return Err(format!("Download failed: {}", e)),
        };

        let status = response.status().as_u16();
        if status == 404 {
            return Err(format!(
                "No FFmpeg binary is published for this device yet ({}). You can use a local FFmpeg file instead, or check {} for updates.",
                asset,
                release_page_url()
            ));
        }
        if !(200..300).contains(&status) && status != 206 {
            return Err(format!(
                "Download failed (HTTP {}). Please try again.",
                status
            ));
        }

        // The server ignored Range and restarted, so truncate the stale part.
        let restarting = status == 200 && resume_from > 0;
        let base_offset = if restarting { 0 } else { resume_from };
        let total_bytes = parse_total_bytes(&response, base_offset);

        let mut file = tokio::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(restarting)
            .append(!restarting)
            .open(&tmp_path)
            .await
            .map_err(|e| format!("Failed to write download file: {}", e))?;

        let mut downloaded = base_offset;
        let mut stream = response.bytes_stream();
        let mut last_emit = std::time::Instant::now();

        loop {
            if state.cancel_requested.load(Ordering::SeqCst) {
                let _ = file.flush().await;
                return Err("cancelled".to_string());
            }

            match stream.next().await {
                Some(Ok(chunk)) => {
                    file.write_all(&chunk)
                        .await
                        .map_err(|e| format!("Failed to write download file: {}", e))?;
                    downloaded += chunk.len() as u64;

                    if last_emit.elapsed().as_millis() >= 150 {
                        last_emit = std::time::Instant::now();
                        let _ = app.emit(
                            "ffmpeg-download-progress",
                            FfmpegProgress {
                                downloaded_bytes: downloaded,
                                total_bytes,
                            },
                        );
                    }
                }
                Some(Err(e)) => {
                    let _ = file.flush().await;
                    last_error = "Connection interrupted. You can resume the download to continue where it left off.".to_string();
                    let _ = e;
                    break;
                }
                None => {
                    let _ = file.flush().await;
                    let _ = app.emit(
                        "ffmpeg-download-progress",
                        FfmpegProgress {
                            downloaded_bytes: downloaded,
                            total_bytes: Some(total_bytes.unwrap_or(downloaded)),
                        },
                    );

                    if downloaded < 1024 * 1024 {
                        last_error =
                            "Downloaded file looks incomplete. Please try again.".to_string();
                        break;
                    }

                    drop(file);
                    tokio::fs::rename(&tmp_path, &final_path)
                        .await
                        .map_err(|e| format!("Failed to finalize download: {}", e))?;

                    #[cfg(unix)]
                    {
                        use std::os::unix::fs::PermissionsExt;
                        let _ = std::fs::set_permissions(
                            &final_path,
                            std::fs::Permissions::from_mode(0o755),
                        );
                    }

                    // Validate that the downloaded binary actually runs.
                    if ffmpeg_version_string(&final_path).is_none() {
                        let _ = std::fs::remove_file(&final_path);
                        return Err(
                            "Downloaded file failed verification. Please try again.".to_string()
                        );
                    }

                    // A fresh download replaces any previously imported file.
                    if let Ok(marker) = imported_marker_path(app) {
                        let _ = std::fs::remove_file(&marker);
                    }

                    return Ok(());
                }
            }
        }

        if attempt < 3 {
            tokio::time::sleep(std::time::Duration::from_secs(1 << attempt)).await;
            continue;
        }
        return Err(last_error);
    }

    Err(last_error)
}
