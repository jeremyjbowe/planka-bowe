/*!
 * planka-bowe — goal sagas.
 */

import { call, put, select } from 'redux-saga/effects';

import request from '../request';
import selectors from '../../../selectors';
import actions from '../../../actions';
import api from '../../../api';
import { createLocalId } from '../../../utils/local-id';
import { GoalStatuses } from '../../../constants/Enums';

export function* createGoal(data) {
  const localId = yield call(createLocalId);
  const currentUserId = yield select(selectors.selectCurrentUserId);
  const goalIds = yield select(selectors.selectGoalIds);

  yield put(
    actions.createGoal({
      status: GoalStatuses.ACTIVE,
      ...data,
      id: localId,
      ownerUserId: currentUserId,
      position: (goalIds.length + 1) * 65536,
    }),
  );

  let goal;
  try {
    ({ item: goal } = yield call(request, api.createGoal, data));
  } catch (error) {
    yield put(actions.createGoal.failure(localId, error));
    return;
  }

  yield put(actions.createGoal.success(localId, goal));
}

export function* handleGoalCreate(goal) {
  yield put(actions.handleGoalCreate(goal));
}

export function* updateGoal(id, data) {
  yield put(actions.updateGoal(id, data));

  let goal;
  try {
    ({ item: goal } = yield call(request, api.updateGoal, id, data));
  } catch (error) {
    yield put(actions.updateGoal.failure(id, error));
    return;
  }

  yield put(actions.updateGoal.success(goal));
}

export function* handleGoalUpdate(goal) {
  yield put(actions.handleGoalUpdate(goal));
}

export function* deleteGoal(id) {
  yield put(actions.deleteGoal(id));

  let goal;
  try {
    ({ item: goal } = yield call(request, api.deleteGoal, id));
  } catch (error) {
    yield put(actions.deleteGoal.failure(id, error));
    return;
  }

  yield put(actions.deleteGoal.success(goal));
}

export function* handleGoalDelete(goal) {
  yield put(actions.handleGoalDelete(goal));
}

export function* createGoalLink(goalId, data) {
  const localId = yield call(createLocalId);

  yield put(
    actions.createGoalLink({
      goalId,
      cardId: data.cardId || null,
      boardId: data.boardId || null,
      id: localId,
    }),
  );

  let goalLink;
  let included;
  try {
    ({ item: goalLink, included } = yield call(request, api.createGoalLink, goalId, data));
  } catch (error) {
    yield put(actions.createGoalLink.failure(localId, error));
    return;
  }

  yield put(actions.createGoalLink.success(localId, goalLink, included));
}

export function* handleGoalLinkCreate(goalLink, included) {
  yield put(actions.handleGoalLinkCreate(goalLink, included));
}

export function* handleGoalLinkUpdate(goalLink, included) {
  yield put(actions.handleGoalLinkUpdate(goalLink, included));
}

export function* deleteGoalLink(id) {
  yield put(actions.deleteGoalLink(id));

  let goalLink;
  try {
    ({ item: goalLink } = yield call(request, api.deleteGoalLink, id));
  } catch (error) {
    yield put(actions.deleteGoalLink.failure(id, error));
    return;
  }

  yield put(actions.deleteGoalLink.success(goalLink));
}

export function* handleGoalLinkDelete(goalLink) {
  yield put(actions.handleGoalLinkDelete(goalLink));
}

export default {
  createGoal,
  handleGoalCreate,
  updateGoal,
  handleGoalUpdate,
  deleteGoal,
  handleGoalDelete,
  createGoalLink,
  handleGoalLinkCreate,
  handleGoalLinkUpdate,
  deleteGoalLink,
  handleGoalLinkDelete,
};
