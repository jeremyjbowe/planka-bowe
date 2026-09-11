/*!
 * planka-bowe — saved view actions (consumed by the ORM reducers).
 */

import ActionTypes from '../constants/ActionTypes';

const createSavedView = (savedView) => ({
  type: ActionTypes.SAVED_VIEW_CREATE,
  payload: {
    savedView,
  },
});

createSavedView.success = (localId, savedView) => ({
  type: ActionTypes.SAVED_VIEW_CREATE__SUCCESS,
  payload: {
    localId,
    savedView,
  },
});

createSavedView.failure = (localId, error) => ({
  type: ActionTypes.SAVED_VIEW_CREATE__FAILURE,
  payload: {
    localId,
    error,
  },
});

const handleSavedViewCreate = (savedView) => ({
  type: ActionTypes.SAVED_VIEW_CREATE_HANDLE,
  payload: {
    savedView,
  },
});

const updateSavedView = (id, data) => ({
  type: ActionTypes.SAVED_VIEW_UPDATE,
  payload: {
    id,
    data,
  },
});

updateSavedView.success = (savedView) => ({
  type: ActionTypes.SAVED_VIEW_UPDATE__SUCCESS,
  payload: {
    savedView,
  },
});

updateSavedView.failure = (id, error) => ({
  type: ActionTypes.SAVED_VIEW_UPDATE__FAILURE,
  payload: {
    id,
    error,
  },
});

const handleSavedViewUpdate = (savedView) => ({
  type: ActionTypes.SAVED_VIEW_UPDATE_HANDLE,
  payload: {
    savedView,
  },
});

const deleteSavedView = (id) => ({
  type: ActionTypes.SAVED_VIEW_DELETE,
  payload: {
    id,
  },
});

deleteSavedView.success = (savedView) => ({
  type: ActionTypes.SAVED_VIEW_DELETE__SUCCESS,
  payload: {
    savedView,
  },
});

deleteSavedView.failure = (id, error) => ({
  type: ActionTypes.SAVED_VIEW_DELETE__FAILURE,
  payload: {
    id,
    error,
  },
});

const handleSavedViewDelete = (savedView) => ({
  type: ActionTypes.SAVED_VIEW_DELETE_HANDLE,
  payload: {
    savedView,
  },
});

// Applies a whole preset to a board at once: the view mode, the search and
// every filter dimension, clearing the ones the preset does not mention.
const applySavedView = (id, data) => ({
  type: ActionTypes.SAVED_VIEW_APPLY,
  payload: {
    id,
    data,
  },
});

export default {
  createSavedView,
  handleSavedViewCreate,
  updateSavedView,
  handleSavedViewUpdate,
  deleteSavedView,
  handleSavedViewDelete,
  applySavedView,
};
