/*!
 * DTP fork — saved view entry actions (the only thing the UI dispatches).
 */

import EntryActionTypes from '../constants/EntryActionTypes';

// data: { name, isShared }; the preset itself is read off the current board
const createSavedViewInCurrentBoard = (data) => ({
  type: EntryActionTypes.SAVED_VIEW_IN_CURRENT_BOARD_CREATE,
  payload: {
    data,
  },
});

const applySavedViewInCurrentBoard = (id) => ({
  type: EntryActionTypes.SAVED_VIEW_IN_CURRENT_BOARD_APPLY,
  payload: {
    id,
  },
});

const handleSavedViewCreate = (savedView) => ({
  type: EntryActionTypes.SAVED_VIEW_CREATE_HANDLE,
  payload: {
    savedView,
  },
});

const updateSavedView = (id, data) => ({
  type: EntryActionTypes.SAVED_VIEW_UPDATE,
  payload: {
    id,
    data,
  },
});

const handleSavedViewUpdate = (savedView) => ({
  type: EntryActionTypes.SAVED_VIEW_UPDATE_HANDLE,
  payload: {
    savedView,
  },
});

const deleteSavedView = (id) => ({
  type: EntryActionTypes.SAVED_VIEW_DELETE,
  payload: {
    id,
  },
});

const handleSavedViewDelete = (savedView) => ({
  type: EntryActionTypes.SAVED_VIEW_DELETE_HANDLE,
  payload: {
    savedView,
  },
});

export default {
  createSavedViewInCurrentBoard,
  applySavedViewInCurrentBoard,
  handleSavedViewCreate,
  updateSavedView,
  handleSavedViewUpdate,
  deleteSavedView,
  handleSavedViewDelete,
};
