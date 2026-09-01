/**
 * theme/ThemeContext.js
 * ---------------------------------------------------------------------------
 * App-wide theme state.
 *
 * `isDark` used to be per-page component state, so the theme silently reset to
 * dark on every navigation and the toggle setter was never even wired up.
 * Holding it here makes the choice apply across pages and persist between
 * visits.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';

import { INTERVIEW_PALETTES, PALETTES } from './palette';

const STORAGE_KEY = 'ss_theme';

const ThemeContext = createContext(null);

/** Read the stored preference, falling back to the OS setting, then dark. */
const initialIsDark = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
  } catch {
    /* private browsing — fall through to the system preference */
  }

  if (typeof window !== 'undefined' && window.matchMedia) {
    return !window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  return true;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(initialIsDark);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      /* quota or private browsing — the theme just won't persist */
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark((prev) => !prev), []);

  const value = useMemo(
    () => ({
      isDark,
      toggleTheme,
      T: isDark ? PALETTES.dark : PALETTES.light,
      // The coding workspace runs on its own near-neutral palette so the
      // statement and the syntax highlighting stay readable; see palette.js.
      IT: isDark ? INTERVIEW_PALETTES.dark : INTERVIEW_PALETTES.light,
    }),
    [isDark, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

export default ThemeContext;
