/*!
 * DTP fork — keyboard navigation runtime.
 *
 * A tiny external store (the same shape as utils/theme.js: mutable module
 * state + a Set of listeners + `useSyncExternalStore` on the React side).
 * It deliberately does NOT live in Redux:
 *
 *  - the selected card is pure view state, it never round-trips to the
 *    server and it must not end up in the redux-logger noise;
 *  - the key handler in components/common/KeyboardNavigation reads it
 *    synchronously inside a `keydown` listener, where a `useSelector`
 *    snapshot would already be stale;
 *  - `Card` subscribes per id, so moving the selection re-renders exactly
 *    two cards instead of the whole board.
 *
 * Five independent pieces of state live here:
 *
 *  1. selectedCardId          — the keyboard cursor (a card id, or null).
 *  2. selectedCardHandlers    — imperative callbacks (`editName`,
 *                               `openActions`) published by the selected
 *                               `Card` so the hover shortcuts in
 *                               boards/Board/ShortcutsProvider can fall back
 *                               to the keyboard selection when the pointer is
 *                               nowhere near a card.
 *  3. shortcuts overlay open  — the `?` cheat sheet; opened from the key
 *                               handler and from the user menu.
 *  4. add-card requests       — a one-shot event bus ("open the composer of
 *                               list X"). `lists/List` and the finite views
 *                               subscribe; only one of them is ever mounted
 *                               for a given board view, so a request is
 *                               unambiguous.
 *  5. the pending `g` chord   — shared so ShortcutsProvider can ignore digit
 *                               presses that are really the second half of
 *                               `g 1` … `g 9`.
 *
 * To extend: add state + listener Set + get/set/subscribe here, then bind the
 * key in components/common/KeyboardNavigation/KeyboardNavigation.jsx and
 * document it in ShortcutsOverlay.jsx.
 */

// ---------------------------------------------------------------------------
// Selected card
// ---------------------------------------------------------------------------

let selectedCardId = null;
let selectedCardHandlers = null;

const selectionListeners = new Set();

export const getSelectedCardId = () => selectedCardId;

export const subscribeToSelectedCardId = (listener) => {
  selectionListeners.add(listener);
  return () => selectionListeners.delete(listener);
};

export const setSelectedCardId = (id) => {
  const nextId = id || null;

  if (nextId === selectedCardId) {
    return;
  }

  selectedCardId = nextId;

  if (!selectedCardId) {
    selectedCardHandlers = null;
  }

  selectionListeners.forEach((listener) => listener());
};

export const clearSelectedCardId = () => {
  setSelectedCardId(null);
};

/*
 * The selected `Card` publishes its imperative callbacks here while it is
 * mounted. They are only available in views that actually render `Card`
 * (kanban / grid / list); the table view exposes the id alone, which is
 * enough for the shortcuts that only need to identify a card (copy, cut…).
 */
export const registerSelectedCardHandlers = (handlers) => {
  selectedCardHandlers = handlers;
};

export const unregisterSelectedCardHandlers = (id) => {
  if (selectedCardHandlers && selectedCardHandlers.id === id) {
    selectedCardHandlers = null;
  }
};

export const getSelectedCardHandlers = () =>
  selectedCardHandlers && selectedCardHandlers.id === selectedCardId ? selectedCardHandlers : null;

// ---------------------------------------------------------------------------
// Shortcuts overlay (the `?` cheat sheet)
// ---------------------------------------------------------------------------

let isShortcutsOverlayOpen = false;

const overlayListeners = new Set();

export const getIsShortcutsOverlayOpen = () => isShortcutsOverlayOpen;

export const subscribeToShortcutsOverlay = (listener) => {
  overlayListeners.add(listener);
  return () => overlayListeners.delete(listener);
};

const setShortcutsOverlayOpen = (value) => {
  if (value === isShortcutsOverlayOpen) {
    return;
  }

  isShortcutsOverlayOpen = value;
  overlayListeners.forEach((listener) => listener());
};

export const openShortcutsOverlay = () => setShortcutsOverlayOpen(true);
export const closeShortcutsOverlay = () => setShortcutsOverlayOpen(false);
export const toggleShortcutsOverlay = () => setShortcutsOverlayOpen(!isShortcutsOverlayOpen);

// ---------------------------------------------------------------------------
// "Open the add-card composer" requests
// ---------------------------------------------------------------------------

const addCardListeners = new Set();

export const subscribeToAddCardRequests = (listener) => {
  addCardListeners.add(listener);
  return () => addCardListeners.delete(listener);
};

/*
 * `listId` is the kanban list to open the composer in. The finite views
 * (grid / list / table) have a single composer and react to any request.
 */
export const requestAddCardInList = (listId) => {
  addCardListeners.forEach((listener) => listener(listId || null));
};

// ---------------------------------------------------------------------------
// The `g` chord (g h → home, g g → goals, g 1…9 → nth board)
// ---------------------------------------------------------------------------

export const G_SEQUENCE_TIMEOUT = 800;

const G_SEQUENCE_GRACE = 100;

let gSequenceExpiresAt = 0;
let gSequenceConsumedAt = 0;

export const startGSequence = () => {
  gSequenceExpiresAt = Date.now() + G_SEQUENCE_TIMEOUT;
  gSequenceConsumedAt = 0;
};

export const endGSequence = () => {
  gSequenceExpiresAt = 0;
};

// The chord is waiting for its second key.
export const isGSequencePending = () => Date.now() < gSequenceExpiresAt;

// The second key arrived and was acted on.
export const consumeGSequence = () => {
  gSequenceExpiresAt = 0;
  gSequenceConsumedAt = Date.now();
};

/*
 * True for every listener that sees the chord's second key, whether it runs
 * before the key handler (the chord is still pending) or after it (the chord
 * was just consumed). Window listeners fire in registration order, which
 * changes as boards mount and unmount, so neither half may be assumed.
 * ShortcutsProvider uses this to ignore the digit of `g 1` … `g 9`.
 */
export const isGSequenceActive = () =>
  isGSequencePending() || Date.now() - gSequenceConsumedAt < G_SEQUENCE_GRACE;

// ---------------------------------------------------------------------------
// DOM helpers shared by the key handler
// ---------------------------------------------------------------------------

// `boards/BoardActions/Filters` stamps this id on the board search input.
export const BOARD_SEARCH_INPUT_ID = 'dtp-board-search';

export const focusBoardSearchInput = () => {
  const element = document.getElementById(BOARD_SEARCH_INPUT_ID);

  if (!element) {
    return false;
  }

  element.focus();
  return true;
};

/*
 * `Card` and the table rows carry `data-card-id`, so a plain `:hover` query
 * tells us whether the pointer is currently parked on a card. Keys that the
 * hover shortcuts already own (`h`/`l` → labels popup, `1`…`9` → toggle
 * label) defer to them in that case.
 */
export const isPointerOverCard = () => !!document.querySelector('[data-card-id]:hover');
