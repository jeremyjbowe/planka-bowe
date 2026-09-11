/*!
 * planka-bowe — React binding for utils/keyboard-navigation.js.
 *
 * `useKeyboardSelection()` returns the selected card id (or null).
 * `useIsCardSelected(id)` is the per-card version: the snapshot is a boolean,
 * so moving the cursor only re-renders the card that lost the selection and
 * the one that gained it.
 */

import { useCallback, useSyncExternalStore } from 'react';

import { getSelectedCardId, subscribeToSelectedCardId } from '../utils/keyboard-navigation';

export function useIsCardSelected(id) {
  const getSnapshot = useCallback(() => getSelectedCardId() === id, [id]);

  return useSyncExternalStore(subscribeToSelectedCardId, getSnapshot);
}

export default function useKeyboardSelection() {
  return useSyncExternalStore(subscribeToSelectedCardId, getSelectedCardId);
}
