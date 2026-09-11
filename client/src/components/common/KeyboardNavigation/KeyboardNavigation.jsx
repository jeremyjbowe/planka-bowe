/*!
 * planka-bowe — keyboard-first navigation.
 *
 * A single `window` keydown listener (mounted once, next to the command
 * palette in components/common/Core) plus the `?` cheat sheet. The selection
 * itself lives in utils/keyboard-navigation.js; this file only maps keys onto
 * it and onto Redux.
 *
 * ─── the key map ────────────────────────────────────────────────────────────
 *
 *   j / k        select next / previous card
 *                  kanban  → within the selected card's list
 *                  others  → over selectFilteredCardIdsForCurrentBoard, i.e.
 *                            exactly the order the view renders
 *   h / l        kanban only: previous / next list, same index (clamped);
 *                empty lists are skipped so the cursor never disappears
 *   Enter / o    open the selected card
 *   Escape       clear the selection
 *   n            open the add-card composer (selected card's list, else the
 *                first kanban list; the finite views open their own composer)
 *   /            focus the board search input
 *   1 … 5        board view: kanban, grid, list, table, timeline
 *   [ / ]        previous / next board of the current project
 *   g h          home              (chord, second key within 800 ms)
 *   g g          goals
 *   g 1 … g 9    nth board of the current project
 *   ?            toggle this cheat sheet
 *
 * ─── deliberate exceptions ──────────────────────────────────────────────────
 *
 *  - Everything is ignored while a text field has focus
 *    (`isActiveTextElement`), while a modifier is held (`?` excepted, it is
 *    Shift+/), and while a Semantic modal / popup or the command palette is
 *    on screen — only `?` still works there, and Escape is left to the modal.
 *  - `h`, `l` and `1`…`9` are handed back to the board's hover shortcuts
 *    (boards/Board/ShortcutsProvider: labels popup, toggle label N) whenever
 *    the pointer sits on a card. Without a hovered card they mean list
 *    navigation / view switching, which is what a keyboard-only user wants.
 *  - `Enter` is handled here for the *selected* card; ShortcutsProvider keeps
 *    handling it for the *hovered* card, so the two never fire together.
 *
 * To add a binding: extend the switch below, add the string to
 * locales/en-US/core.js and list it in ShortcutsOverlay.jsx.
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { push } from '../../../lib/redux-router';

import store from '../../../store';
import selectors from '../../../selectors';
import entryActions from '../../../entry-actions';
import Paths from '../../../constants/Paths';
import { BoardContexts, BoardViews } from '../../../constants/Enums';
import { isActiveTextElement } from '../../../utils/element-helpers';
import { isModifierKeyPressed } from '../../../utils/event-helpers';
import {
  clearSelectedCardId,
  closeShortcutsOverlay,
  consumeGSequence,
  endGSequence,
  focusBoardSearchInput,
  getIsShortcutsOverlayOpen,
  getSelectedCardId,
  isGSequencePending,
  isPointerOverCard,
  requestAddCardInList,
  setSelectedCardId,
  startGSequence,
  subscribeToShortcutsOverlay,
  toggleShortcutsOverlay,
} from '../../../utils/keyboard-navigation';
import ShortcutsOverlay from './ShortcutsOverlay';

const VIEW_BY_DIGIT = {
  1: BoardViews.KANBAN,
  2: BoardViews.GRID,
  3: BoardViews.LIST,
  4: BoardViews.TABLE,
  5: BoardViews.TIMELINE,
};

// One instance is enough: the handler is synchronous and never re-entrant.
const selectFilteredCardIdsByListId = selectors.makeSelectFilteredCardIdsByListId();

const getKanbanListIds = (state) => selectors.selectKanbanListIdsForCurrentBoard(state) || [];

const getCardIdsInList = (state, listId) =>
  (listId && selectFilteredCardIdsByListId(state, listId)) || [];

/*
 * The order the non-kanban views render. `FiniteContent` (a normal board)
 * feeds them the whole board; `EndlessContent` (archive / trash) feeds them
 * the single list it is showing, so the cursor has to follow suit.
 */
const getFlatCardIds = (state) => {
  const board = selectors.selectCurrentBoard(state);

  if (board && board.context !== BoardContexts.BOARD) {
    return selectors.selectFilteredCardIdsForCurrentList(state) || [];
  }

  return selectors.selectFilteredCardIdsForCurrentBoard(state) || [];
};

const getSelectedCardListId = (state) => {
  const cardId = getSelectedCardId();

  if (!cardId) {
    return null;
  }

  const card = selectors.selectCardById(state, cardId);
  return (card && card.listId) || null;
};

// The first card of the first non-empty list — the "nothing selected yet" seed.
const selectFirstKanbanCard = (state) => {
  const listIds = getKanbanListIds(state);

  const listId = listIds.find((id) => getCardIdsInList(state, id).length > 0);

  if (!listId) {
    return;
  }

  setSelectedCardId(getCardIdsInList(state, listId)[0]);
};

const clamp = (value, max) => Math.min(Math.max(value, 0), max);

const moveWithinKanbanList = (state, delta) => {
  const listId = getSelectedCardListId(state);
  const cardIds = getCardIdsInList(state, listId);
  const index = cardIds.indexOf(getSelectedCardId());

  if (index === -1) {
    selectFirstKanbanCard(state);
    return;
  }

  setSelectedCardId(cardIds[clamp(index + delta, cardIds.length - 1)]);
};

const moveAcrossKanbanLists = (state, delta) => {
  const listIds = getKanbanListIds(state);
  const listId = getSelectedCardListId(state);
  const listIndex = listIds.indexOf(listId);

  if (listIndex === -1) {
    selectFirstKanbanCard(state);
    return;
  }

  const cardIndex = getCardIdsInList(state, listId).indexOf(getSelectedCardId());

  // Skip empty lists so the cursor is never dropped on the way.
  for (let index = listIndex + delta; index >= 0 && index < listIds.length; index += delta) {
    const cardIds = getCardIdsInList(state, listIds[index]);

    if (cardIds.length > 0) {
      setSelectedCardId(cardIds[clamp(cardIndex, cardIds.length - 1)]);
      return;
    }
  }
};

const moveInFlatView = (state, delta) => {
  const cardIds = getFlatCardIds(state);

  if (cardIds.length === 0) {
    return;
  }

  const index = cardIds.indexOf(getSelectedCardId());

  setSelectedCardId(index === -1 ? cardIds[0] : cardIds[clamp(index + delta, cardIds.length - 1)]);
};

const moveSelection = (state, delta) => {
  const board = selectors.selectCurrentBoard(state);

  if (!board) {
    return;
  }

  if (board.view === BoardViews.KANBAN) {
    moveWithinKanbanList(state, delta);
  } else {
    moveInFlatView(state, delta);
  }
};

const KeyboardNavigation = React.memo(() => {
  const boardId = useSelector((state) => selectors.selectPath(state).boardId);

  const isOverlayOpen = useSyncExternalStore(
    subscribeToShortcutsOverlay,
    getIsShortcutsOverlayOpen,
  );

  const dispatch = useDispatch();

  // A card id only means something on the board it belongs to.
  useEffect(() => {
    clearSelectedCardId();
  }, [boardId]);

  useEffect(() => {
    const openSelectedCard = () => {
      const cardId = getSelectedCardId();

      if (!cardId) {
        return false;
      }

      const card = selectors.selectCardById(store.getState(), cardId);

      if (!card || !card.isPersisted) {
        return false;
      }

      dispatch(push(Paths.CARDS.replace(':id', card.id)));
      return true;
    };

    const openAddCard = (state) => {
      const listId = getSelectedCardListId(state) || selectors.selectFirstKanbanListId(state);
      requestAddCardInList(listId);
    };

    const moveToBoard = (state, delta) => {
      const boardIds = selectors.selectBoardIdsForCurrentProject(state) || [];
      const index = boardIds.indexOf(selectors.selectPath(state).boardId);

      if (index === -1 || boardIds.length < 2) {
        return;
      }

      const nextIndex = (index + delta + boardIds.length) % boardIds.length;
      dispatch(push(Paths.BOARDS.replace(':id', boardIds[nextIndex])));
    };

    // The second half of a `g` chord. Returns true when it consumed the key.
    const handleGSequence = (event) => {
      endGSequence();

      if (event.key === 'h') {
        consumeGSequence();
        dispatch(push(Paths.ROOT));

        return true;
      }

      if (event.key === 'g') {
        consumeGSequence();
        dispatch(push(Paths.GOALS));

        return true;
      }

      if (/^[1-9]$/.test(event.key)) {
        consumeGSequence();

        const boardIds = selectors.selectBoardIdsForCurrentProject(store.getState()) || [];
        const nextBoardId = boardIds[parseInt(event.key, 10) - 1];

        if (nextBoardId) {
          dispatch(push(Paths.BOARDS.replace(':id', nextBoardId)));
        }

        return true;
      }

      return false;
    };

    const handleKeyDown = (event) => {
      if (isActiveTextElement(event.target) || event.target.isContentEditable) {
        return;
      }

      // `?` is Shift+/, so it has to be answered before the modifier guard.
      if (event.key === '?') {
        event.preventDefault();
        toggleShortcutsOverlay();
        return;
      }

      if (getIsShortcutsOverlayOpen()) {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeShortcutsOverlay();
        }

        return;
      }

      if (isModifierKeyPressed(event) || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // A modal, a popup or the command palette owns the keyboard while open.
      if (document.querySelector('.ui.modal, .ui.popup, [role="dialog"]')) {
        return;
      }

      if (isGSequencePending()) {
        if (handleGSequence(event)) {
          event.preventDefault();
          return;
        }
      } else {
        endGSequence();
      }

      const state = store.getState();
      const board = selectors.selectCurrentBoard(state);

      switch (event.key) {
        case 'g':
          event.preventDefault();
          startGSequence();

          return;
        case 'j':
          event.preventDefault();
          moveSelection(state, 1);

          return;
        case 'k':
          event.preventDefault();
          moveSelection(state, -1);

          return;
        case 'Escape':
          if (getSelectedCardId()) {
            event.preventDefault();
            clearSelectedCardId();
          }

          return;
        case 'Enter':
        case 'o':
          if (openSelectedCard()) {
            event.preventDefault();
          }

          return;
        case 'n':
          if (board) {
            event.preventDefault();
            openAddCard(state);
          }

          return;
        case '/':
          if (focusBoardSearchInput()) {
            event.preventDefault();
          }

          return;
        case '[':
          event.preventDefault();
          moveToBoard(state, -1);

          return;
        case ']':
          event.preventDefault();
          moveToBoard(state, 1);

          return;
        default:
      }

      // Keys the hover shortcuts own while the pointer rests on a card.
      if (isPointerOverCard()) {
        return;
      }

      if (board && board.view === BoardViews.KANBAN && (event.key === 'h' || event.key === 'l')) {
        event.preventDefault();
        moveAcrossKanbanLists(state, event.key === 'h' ? -1 : 1);

        return;
      }

      const view = VIEW_BY_DIGIT[event.key];

      if (view && board && board.context === BoardContexts.BOARD && board.view !== view) {
        event.preventDefault();
        dispatch(entryActions.updateViewInCurrentBoard(view));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch]);

  if (!isOverlayOpen) {
    return null;
  }

  return <ShortcutsOverlay onClose={closeShortcutsOverlay} />;
});

export default KeyboardNavigation;
