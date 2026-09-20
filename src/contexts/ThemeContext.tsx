/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  ThemeContext.tsx
 *  Theme provider with system sync and pre-paint flash prevention.
 *-----------------------------------------------------------------------------------------------*/

/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import {
  applyThemeToDom,
  getResolvedFromDom,
  getStoredTheme,
  requestTheme,
  resolveThemeName,
  subscribeTheme,
  type ResolvedTheme,
  type Theme,
} from '@/lib/theme';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    getResolvedFromDom(getStoredTheme()),
  );

  // Apply updates before paint to avoid a visible flash.
  useLayoutEffect(() => {
    const resolved = resolveThemeName(theme);
    setResolvedTheme(resolved);
    applyThemeToDom(resolved);
  }, [theme]);

  // Follow external requests such as the ui.theme.set command.
  useEffect(() => {
    return subscribeTheme((next) => {
      setThemeState((current) => (current === next ? current : next));
    });
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = mediaQuery.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyThemeToDom(resolved);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    requestTheme(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
