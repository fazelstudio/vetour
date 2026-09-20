/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  vite.config.ts
 *  Vite configuration with Tauri dev server and chunk splitting.
 *-----------------------------------------------------------------------------------------------*/

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// Vite configuration reference is available at https://vite.dev/config/.
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  /*
  Vite options tailored for Tauri development.
  They apply only to tauri dev and tauri build.
  1. Keep Rust errors visible in the output.
  2. Require the fixed dev port expected by Tauri.
  */
  clearScreen: false,
  // Tauri expects a fixed port and fails when it is unavailable.
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Ignore Tauri sources and project files during reloads.
      ignored: ["**/src-tauri/**", "**/*.vetour"],
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'psv': [
            '@photo-sphere-viewer/core', 
            '@photo-sphere-viewer/virtual-tour-plugin', 
            '@photo-sphere-viewer/markers-plugin'
          ],
          'document-renderers': ['mammoth', 'xlsx', 'papaparse', 'react-markdown']
        }
      }
    }
  }
}));