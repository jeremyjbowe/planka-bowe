/*!
 * planka-bowe — saved view sagas.
 */

import { call, put, select } from 'redux-saga/effects';

import request from '../request';
import selectors from '../../../selectors';
import actions from '../../../actions';
import api from '../../../api';
import { createLocalId } from '../../../utils/local-id';

export function* createSavedViewInCurrentBoard(data) {
  const { boardId } = yield select(selectors.selectPath);
  const filters = yield select(selectors.selectFiltersForCurrentBoard);
  const currentUserId = yield select(selectors.selectCurrentUserId);

  if (!boardId || !filters) {
    return;
  }

  const localId = yield call(createLocalId);
  const savedViewIds = yield select(selectors.selectSavedViewIdsForCurrentBoard);

  const nextData = {
    name: data.name,
    isShared: !!data.isShared,
    data: filters,
  };

  yield put(
    actions.createSavedView({
      ...nextData,
      id: localId,
      boardId,
      creatorUserId: currentUserId,
      position: (savedViewIds.length + 1) * 65536,
    }),
  );

  let savedView;
  try {
    ({ item: savedView } = yield call(request, api.createSavedView, boardId, nextData));
  } catch (error) {
    yield put(actions.createSavedView.failure(localId, error));
    return;
  }

  yield put(actions.createSavedView.success(localId, savedView));
}

export function* handleSavedViewCreate(savedView) {
  yield put(actions.handleSavedViewCreate(savedView));
}

export function* updateSavedView(id, data) {
  yield put(actions.updateSavedView(id, data));

  let savedView;
  try {
    ({ item: savedView } = yield call(request, api.updateSavedView, id, data));
  } catch (error) {
    yield put(actions.updateSavedView.failure(id, error));
    return;
  }

  yield put(actions.updateSavedView.success(savedView));
}

export function* handleSavedViewUpdate(savedView) {
  const currentUserId = yield select(selectors.selectCurrentUserId);

  // A view that just became personal is no longer ours to see; the server
  // broadcasts the change to the board room so everybody can drop it.
  if (!savedView.isShared && savedView.creatorUserId !== currentUserId) {
    yield put(actions.handleSavedViewDelete(savedView));
    return;
  }

  yield put(actions.handleSavedViewUpdate(savedView));
}

export function* deleteSavedView(id) {
  yield put(actions.deleteSavedView(id));

  let savedView;
  try {
    ({ item: savedView } = yield call(request, api.deleteSavedView, id));
  } catch (error) {
    yield put(actions.deleteSavedView.failure(id, error));
    return;
  }

  yield put(actions.deleteSavedView.success(savedView));
}

export function* handleSavedViewDelete(savedView) {
  yield put(actions.handleSavedViewDelete(savedView));
}

export function* applySavedViewInCurrentBoard(id) {
  const { boardId } = yield select(selectors.selectPath);
  const savedView = yield select(selectors.selectSavedViewById, id);
  const currentUserId = yield select(selectors.selectCurrentUserId);

  if (!boardId || !savedView) {
    return;
  }

  const data = savedView.data || {};

  yield put(
    actions.applySavedView(boardId, {
      ...data,
      filterCurrentUserId: data.filterAssignedToMe ? currentUserId : null,
    }),
  );
}

export default {
  createSavedViewInCurrentBoard,
  handleSavedViewCreate,
  updateSavedView,
  handleSavedViewUpdate,
  deleteSavedView,
  handleSavedViewDelete,
  applySavedViewInCurrentBoard,
};
