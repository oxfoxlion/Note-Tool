export const THEME_STORAGE_KEY = 'note_tool_theme';

export type ThemeMode = 'light' | 'dark';

export function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }
  } catch {
    // ignore storage read failure
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyThemeMode(themeMode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const themeClass = themeMode === 'dark' ? 'theme-dark' : 'theme-light';
  root.classList.remove('theme-light', 'theme-dark');
  root.classList.add(themeClass);
  root.dataset.colorMode = themeMode;

  if (document.body) {
    document.body.dataset.colorMode = themeMode;
  }

  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.classList.remove('theme-light', 'theme-dark');
    appRoot.classList.add(themeClass);
    appRoot.dataset.colorMode = themeMode;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  } catch {
    // ignore storage write failure
  }
}
