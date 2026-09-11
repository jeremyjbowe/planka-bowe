/*!
 * planka-bowe — theme runtime.
 *
 * A tiny external store (no Redux needed) that knows the user's preference
 * ("system" | "light" | "dark"), resolves it against `prefers-color-scheme`,
 * stamps `data-theme` on <html> so styles/theme.css can flip its tokens, and
 * keeps the browser chrome color in sync. React reads it through
 * hooks/use-theme.js.
 */

export const ThemePreferences = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark',
};

export const Themes = {
  LIGHT: 'light',
  DARK: 'dark',
};

const STORAGE_KEY = 'bowe_theme';
const THEME_COLOR_BY_THEME = {
  [Themes.DARK]: '#0f0f12',
  [Themes.LIGHT]: '#f4f4f7',
};

const mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set();

const readPreference = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return Object.values(ThemePreferences).includes(value) ? value : ThemePreferences.SYSTEM;
  } catch {
    return ThemePreferences.SYSTEM;
  }
};

let preference = readPreference();

export const resolveTheme = (value = preference) => {
  if (value === ThemePreferences.SYSTEM) {
    // Soft dark is the default; light only when the OS explicitly asks for it.
    if (mediaQuery && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return Themes.LIGHT;
    }

    return Themes.DARK;
  }

  return value;
};

const apply = () => {
  const theme = resolveTheme();

  document.documentElement.setAttribute('data-theme', theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLOR_BY_THEME[theme]);
  }

  listeners.forEach((listener) => listener());
};

export const getThemePreference = () => preference;

export const getTheme = () => resolveTheme();

export const setThemePreference = (value) => {
  preference = value;

  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage may be unavailable; the choice lasts for this session only.
  }

  apply();
};

export const cycleThemePreference = () => {
  const order = [ThemePreferences.SYSTEM, ThemePreferences.LIGHT, ThemePreferences.DARK];
  setThemePreference(order[(order.indexOf(preference) + 1) % order.length]);
};

export const subscribeToTheme = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

if (mediaQuery) {
  const handleChange = () => {
    if (preference === ThemePreferences.SYSTEM) {
      apply();
    }
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
  } else {
    mediaQuery.addListener(handleChange);
  }
}

apply();
