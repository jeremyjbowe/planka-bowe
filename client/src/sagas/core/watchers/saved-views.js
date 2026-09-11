/*!
 * planka-bowe — saved view watchers.
 */

import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* savedViewsWatchers() {
  yield all([
    takeEvery(EntryActionTypes.SAVED_VIEW_IN_CURRENT_BOARD_CREATE, ({ payload: { data } }) =>
      services.createSavedViewInCurrentBoard(data),
    ),
    takeEvery(EntryActionTypes.SAVED_VIEW_IN_CURRENT_BOARD_APPLY, ({ payload: { id } }) =>
      services.applySavedViewInCurrentBoard(id),
    ),
    takeEvery(EntryActionTypes.SAVED_VIEW_CREATE_HANDLE, ({ payload: { savedView } }) =>
      services.handleSavedViewCreate(savedView),
    ),
    takeEvery(EntryActionTypes.SAVED_VIEW_UPDATE, ({ payload: { id, data } }) =>
      services.updateSavedView(id, data),
    ),
    takeEvery(EntryActionTypes.SAVED_VIEW_UPDATE_HANDLE, ({ payload: { savedView } }) =>
      services.handleSavedViewUpdate(savedView),
    ),
    takeEvery(EntryActionTypes.SAVED_VIEW_DELETE, ({ payload: { id } }) =>
      services.deleteSavedView(id),
    ),
    takeEvery(EntryActionTypes.SAVED_VIEW_DELETE_HANDLE, ({ payload: { savedView } }) =>
      services.handleSavedViewDelete(savedView),
    ),
  ]);
}
