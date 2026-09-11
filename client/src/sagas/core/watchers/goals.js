/*!
 * planka-bowe — goal watchers.
 */

import { all, takeEvery } from 'redux-saga/effects';

import services from '../services';
import EntryActionTypes from '../../../constants/EntryActionTypes';

export default function* goalsWatchers() {
  yield all([
    takeEvery(EntryActionTypes.GOAL_CREATE, ({ payload: { data } }) => services.createGoal(data)),
    takeEvery(EntryActionTypes.GOAL_CREATE_HANDLE, ({ payload: { goal } }) =>
      services.handleGoalCreate(goal),
    ),
    takeEvery(EntryActionTypes.GOAL_UPDATE, ({ payload: { id, data } }) =>
      services.updateGoal(id, data),
    ),
    takeEvery(EntryActionTypes.GOAL_UPDATE_HANDLE, ({ payload: { goal } }) =>
      services.handleGoalUpdate(goal),
    ),
    takeEvery(EntryActionTypes.GOAL_DELETE, ({ payload: { id } }) => services.deleteGoal(id)),
    takeEvery(EntryActionTypes.GOAL_DELETE_HANDLE, ({ payload: { goal } }) =>
      services.handleGoalDelete(goal),
    ),
    takeEvery(EntryActionTypes.GOAL_LINK_CREATE, ({ payload: { goalId, data } }) =>
      services.createGoalLink(goalId, data),
    ),
    takeEvery(EntryActionTypes.GOAL_LINK_CREATE_HANDLE, ({ payload: { goalLink, included } }) =>
      services.handleGoalLinkCreate(goalLink, included),
    ),
    takeEvery(EntryActionTypes.GOAL_LINK_UPDATE_HANDLE, ({ payload: { goalLink, included } }) =>
      services.handleGoalLinkUpdate(goalLink, included),
    ),
    takeEvery(EntryActionTypes.GOAL_LINK_DELETE, ({ payload: { id } }) =>
      services.deleteGoalLink(id),
    ),
    takeEvery(EntryActionTypes.GOAL_LINK_DELETE_HANDLE, ({ payload: { goalLink } }) =>
      services.handleGoalLinkDelete(goalLink),
    ),
  ]);
}
