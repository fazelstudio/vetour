/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  main.rs
 *  Binary entry point that launches the Tauri application.
 *-----------------------------------------------------------------------------------------------*/

// Prevent an extra console window on Windows release builds. Do not remove.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    obsipano_lib::run()
}
