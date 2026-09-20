/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  file_lock.rs
 *  Exclusive project file locking to prevent concurrent edits.
 *-----------------------------------------------------------------------------------------------*/

use std::fs::File;
use std::sync::Mutex;
use tauri::State;

#[derive(Default)]
pub struct FileLockState(pub Mutex<Option<File>>);

#[tauri::command]
pub fn lock_project_file(path: String, state: State<'_, FileLockState>) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();

    *lock = None;

    let file = File::open(&path).map_err(|e| format!("Failed to lock file: {}", e))?;
    fs2::FileExt::lock_shared(&file).map_err(|e| format!("Failed to lock file: {}", e))?;
    *lock = Some(file);
    Ok(())
}

#[tauri::command]
pub fn unlock_project_file(state: State<'_, FileLockState>) {
    let mut lock = state.0.lock().unwrap();
    if let Some(ref file) = *lock {
        let _ = fs2::FileExt::unlock(file);
    }
    *lock = None;
}
