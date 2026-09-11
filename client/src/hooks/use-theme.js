/*!
 * planka-bowe — React binding for utils/theme.js.
 */

import { useSyncExternalStore } from 'react';

import { getTheme, getThemePreference, subscribeToTheme } from '../utils/theme';

export default function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme);
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference);

  return { theme, preference };
}
