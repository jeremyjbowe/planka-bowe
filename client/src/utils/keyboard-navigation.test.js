import {
  BOARD_SEARCH_INPUT_ID,
  G_SEQUENCE_TIMEOUT,
  clearSelectedCardId,
  closeShortcutsOverlay,
  consumeGSequence,
  endGSequence,
  focusBoardSearchInput,
  getIsShortcutsOverlayOpen,
  getSelectedCardHandlers,
  getSelectedCardId,
  isGSequenceActive,
  isGSequencePending,
  isPointerOverCard,
  openShortcutsOverlay,
  registerSelectedCardHandlers,
  requestAddCardInList,
  setSelectedCardId,
  startGSequence,
  subscribeToAddCardRequests,
  subscribeToSelectedCardId,
  subscribeToShortcutsOverlay,
  toggleShortcutsOverlay,
  unregisterSelectedCardHandlers,
} from './keyboard-navigation';

// This module is a single mutable store shared by the whole file, so reset
// every observable piece of state before each test.
beforeEach(() => {
  clearSelectedCardId(); // also resets the handlers registered for the selected card
  if (getIsShortcutsOverlayOpen()) {
    closeShortcutsOverlay();
  }
  endGSequence();
});

describe('selected card id', () => {
  test('defaults to null', () => {
    expect(getSelectedCardId()).toBeNull();
  });

  test('setSelectedCardId updates the value returned by getSelectedCardId', () => {
    setSelectedCardId('card-1');
    expect(getSelectedCardId()).toBe('card-1');
  });

  test('coerces a falsy id to null', () => {
    setSelectedCardId('card-1');
    setSelectedCardId('');
    expect(getSelectedCardId()).toBeNull();
  });

  test('clearSelectedCardId resets the id to null', () => {
    setSelectedCardId('card-1');
    clearSelectedCardId();
    expect(getSelectedCardId()).toBeNull();
  });

  test('subscribers are notified when the id changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToSelectedCardId(listener);

    setSelectedCardId('card-1');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  test('subscribers are not notified when setting the same id again', () => {
    setSelectedCardId('card-1');

    const listener = jest.fn();
    const unsubscribe = subscribeToSelectedCardId(listener);

    setSelectedCardId('card-1');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  test('unsubscribing stops further notifications', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToSelectedCardId(listener);

    unsubscribe();
    setSelectedCardId('card-1');

    expect(listener).not.toHaveBeenCalled();
  });

  test('multiple subscribers are all notified', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();

    const unsubscribeA = subscribeToSelectedCardId(listenerA);
    const unsubscribeB = subscribeToSelectedCardId(listenerB);

    setSelectedCardId('card-1');

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);

    unsubscribeA();
    unsubscribeB();
  });
});

describe('selected card handlers', () => {
  test('returns null when no handlers are registered', () => {
    setSelectedCardId('card-1');
    expect(getSelectedCardHandlers()).toBeNull();
  });

  test('returns the handlers once registered for the currently selected card', () => {
    setSelectedCardId('card-1');

    const handlers = { id: 'card-1', editName: jest.fn() };
    registerSelectedCardHandlers(handlers);

    expect(getSelectedCardHandlers()).toBe(handlers);
  });

  test('returns null when the registered handlers belong to a different card', () => {
    setSelectedCardId('card-1');
    registerSelectedCardHandlers({ id: 'card-2', editName: jest.fn() });

    expect(getSelectedCardHandlers()).toBeNull();
  });

  test('clearing the selection also clears the handlers', () => {
    setSelectedCardId('card-1');
    registerSelectedCardHandlers({ id: 'card-1', editName: jest.fn() });

    clearSelectedCardId();
    setSelectedCardId('card-1');

    expect(getSelectedCardHandlers()).toBeNull();
  });

  test('unregisterSelectedCardHandlers clears only a matching id', () => {
    setSelectedCardId('card-1');
    registerSelectedCardHandlers({ id: 'card-1', editName: jest.fn() });

    unregisterSelectedCardHandlers('card-2');
    expect(getSelectedCardHandlers()).not.toBeNull();

    unregisterSelectedCardHandlers('card-1');
    expect(getSelectedCardHandlers()).toBeNull();
  });
});

describe('shortcuts overlay', () => {
  test('defaults to closed', () => {
    expect(getIsShortcutsOverlayOpen()).toBe(false);
  });

  test('openShortcutsOverlay / closeShortcutsOverlay toggle the flag and notify subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToShortcutsOverlay(listener);

    openShortcutsOverlay();
    expect(getIsShortcutsOverlayOpen()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    closeShortcutsOverlay();
    expect(getIsShortcutsOverlayOpen()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });

  test('does not notify subscribers when the state does not change', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToShortcutsOverlay(listener);

    closeShortcutsOverlay(); // already closed
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });

  test('toggleShortcutsOverlay flips the current state', () => {
    expect(getIsShortcutsOverlayOpen()).toBe(false);

    toggleShortcutsOverlay();
    expect(getIsShortcutsOverlayOpen()).toBe(true);

    toggleShortcutsOverlay();
    expect(getIsShortcutsOverlayOpen()).toBe(false);
  });
});

describe('add-card requests', () => {
  test('notifies subscribers with the requested list id', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToAddCardRequests(listener);

    requestAddCardInList('list-1');
    expect(listener).toHaveBeenCalledWith('list-1');

    unsubscribe();
  });

  test('coerces a falsy list id to null', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToAddCardRequests(listener);

    requestAddCardInList();
    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
  });

  test('notifies every subscriber', () => {
    const listenerA = jest.fn();
    const listenerB = jest.fn();

    const unsubscribeA = subscribeToAddCardRequests(listenerA);
    const unsubscribeB = subscribeToAddCardRequests(listenerB);

    requestAddCardInList('list-1');

    expect(listenerA).toHaveBeenCalledWith('list-1');
    expect(listenerB).toHaveBeenCalledWith('list-1');

    unsubscribeA();
    unsubscribeB();
  });
});

describe('g chord sequence', () => {
  test('is not pending before startGSequence is called', () => {
    expect(isGSequencePending()).toBe(false);
    expect(isGSequenceActive()).toBe(false);
  });

  test('is pending immediately after startGSequence', () => {
    startGSequence();
    expect(isGSequencePending()).toBe(true);
    expect(isGSequenceActive()).toBe(true);
  });

  test('is no longer pending once the timeout elapses', () => {
    jest.useFakeTimers();
    startGSequence();

    jest.advanceTimersByTime(G_SEQUENCE_TIMEOUT + 1);

    expect(isGSequencePending()).toBe(false);
    jest.useRealTimers();
  });

  test('endGSequence cancels a pending sequence', () => {
    startGSequence();
    endGSequence();

    expect(isGSequencePending()).toBe(false);
    expect(isGSequenceActive()).toBe(false);
  });

  test('consumeGSequence ends the pending state but keeps the sequence "active" briefly', () => {
    startGSequence();
    consumeGSequence();

    expect(isGSequencePending()).toBe(false);
    expect(isGSequenceActive()).toBe(true);
  });

  test('consumeGSequence grace period eventually expires', () => {
    jest.useFakeTimers();
    startGSequence();
    consumeGSequence();

    jest.advanceTimersByTime(200);

    expect(isGSequenceActive()).toBe(false);
    jest.useRealTimers();
  });
});

// jsdom is not installed in this project (jest runs under the default
// "node" test environment), so these two helpers are exercised against a
// minimal hand-rolled `document` stub rather than a real DOM.
describe('DOM helpers', () => {
  const originalDocument = global.document;

  afterEach(() => {
    global.document = originalDocument;
  });

  test('focusBoardSearchInput returns false when the input is not in the document', () => {
    global.document = { getElementById: jest.fn(() => null) };

    expect(focusBoardSearchInput()).toBe(false);
    expect(global.document.getElementById).toHaveBeenCalledWith(BOARD_SEARCH_INPUT_ID);
  });

  test('focusBoardSearchInput focuses the element and returns true when present', () => {
    const element = { focus: jest.fn() };
    global.document = { getElementById: jest.fn(() => element) };

    expect(focusBoardSearchInput()).toBe(true);
    expect(element.focus).toHaveBeenCalledTimes(1);
  });

  test('isPointerOverCard is false when nothing matches :hover', () => {
    global.document = { querySelector: jest.fn(() => null) };

    expect(isPointerOverCard()).toBe(false);
    expect(global.document.querySelector).toHaveBeenCalledWith('[data-card-id]:hover');
  });

  test('isPointerOverCard is true when a card element matches :hover', () => {
    global.document = { querySelector: jest.fn(() => ({})) };

    expect(isPointerOverCard()).toBe(true);
  });
});
