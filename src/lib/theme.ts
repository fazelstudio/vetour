/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  theme.ts
 *  Framework-free theme storage, resolution, and cross-surface sync for commands.
 *-----------------------------------------------------------------------------------------------*/

import { STORAGE_KEY_THEME } from '@/constants';

export type Theme = 'light' | 'dark' | 'black' | 'system';
export type ResolvedTheme = 'light' | 'dark' | 'black';

const STORAGE_KEY = STORAGE_KEY_THEME;

// Hex values must stay in sync with index.css and the pre-paint script in index.html.
export const THEME_BACKGROUNDS: Record<ResolvedTheme, string> = {
  light: '#ffffff',
  dark: '#1a1a2e',
  black: '#000000',
};

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'black' || value === 'system';
}

// Read the persisted preference without touching React state.
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Storage may be unavailable; fall through to the default.
  }
  return 'system';
}

export function resolveThemeName(theme: Theme): ResolvedTheme {
  if (theme === 'system') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
  return theme;
}

export function applyThemeToDom(resolved: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.backgroundColor = THEME_BACKGROUNDS[resolved];
  document.documentElement.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_BACKGROUNDS[resolved]);
}

/*
Read the theme already applied by the pre-paint script.
This keeps the first render matched with the visible frame.
*/
export function getResolvedFromDom(fallback: Theme): ResolvedTheme {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark' || attr === 'black') return attr;
  return resolveThemeName(fallback);
}

type ThemeListener = (theme: Theme) => void;
const listeners = new Set<ThemeListener>();

// Subscribe to out-of-React theme changes such as extension commands.
export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Persist, paint, and broadcast a theme request from any surface.
export function requestTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable; the DOM update below still applies.
  }
  applyThemeToDom(resolveThemeName(theme));
  for (const listener of [...listeners]) {
    try {
      listener(theme);
    } catch (e) {
      console.error('Theme listener failed', e);
    }
  }
}

// Current preference for commands, read from the shared storage.
export function currentTheme(): Theme {
  return getStoredTheme();
}

// Currently painted theme for commands and extensions.
export function currentResolvedTheme(): ResolvedTheme {
  return getResolvedFromDom(getStoredTheme());
}
