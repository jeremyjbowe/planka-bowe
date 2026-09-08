/*!
 * DTP fork — goal actions (consumed by the ORM reducers).
 */

import ActionTypes from '../constants/ActionTypes';

const createGoal = (goal) => ({
  type: ActionTypes.GOAL_CREATE,
  payload: {
    goal,
  },
});

createGoal.success = (localId, goal) => ({
  type: ActionTypes.GOAL_CREATE__SUCCESS,
  payload: {
    localId,
    goal,
  },
});

createGoal.failure = (localId, error) => ({
  type: ActionTypes.GOAL_CREATE__FAILURE,
  payload: {
    localId,
    error,
  },
});

const handleGoalCreate = (goal) => ({
  type: ActionTypes.GOAL_CREATE_HANDLE,
  payload: {
    goal,
  },
});

const updateGoal = (id, data) => ({
  type: ActionTypes.GOAL_UPDATE,
  payload: {
    id,
    data,
  },
});

updateGoal.success = (goal) => ({
  type: ActionTypes.GOAL_UPDATE__SUCCESS,
  payload: {
    goal,
  },
});

updateGoal.failure = (id, error) => ({
  type: ActionTypes.GOAL_UPDATE__FAILURE,
  payload: {
    id,
    error,
  },
});

const handleGoalUpdate = (goal) => ({
  type: ActionTypes.GOAL_UPDATE_HANDLE,
  payload: {
    goal,
  },
});

const deleteGoal = (id) => ({
  type: ActionTypes.GOAL_DELETE,
  payload: {
    id,
  },
});

deleteGoal.success = (goal) => ({
  type: ActionTypes.GOAL_DELETE__SUCCESS,
  payload: {
    goal,
  },
});

deleteGoal.failure = (id, error) => ({
  type: ActionTypes.GOAL_DELETE__FAILURE,
  payload: {
    id,
    error,
  },
});

const handleGoalDelete = (goal) => ({
  type: ActionTypes.GOAL_DELETE_HANDLE,
  payload: {
    goal,
  },
});

const createGoalLink = (goalLink) => ({
  type: ActionTypes.GOAL_LINK_CREATE,
  payload: {
    goalLink,
  },
});

createGoalLink.success = (localId, goalLink, included) => ({
  type: ActionTypes.GOAL_LINK_CREATE__SUCCESS,
  payload: {
    localId,
    goalLink,
    included,
  },
});

createGoalLink.failure = (localId, error) => ({
  type: ActionTypes.GOAL_LINK_CREATE__FAILURE,
  payload: {
    localId,
    error,
  },
});

const handleGoalLinkCreate = (goalLink, included) => ({
  type: ActionTypes.GOAL_LINK_CREATE_HANDLE,
  payload: {
    goalLink,
    included,
  },
});

const handleGoalLinkUpdate = (goalLink, included) => ({
  type: ActionTypes.GOAL_LINK_UPDATE_HANDLE,
  payload: {
    goalLink,
    included,
  },
});

const deleteGoalLink = (id) => ({
  type: ActionTypes.GOAL_LINK_DELETE,
  payload: {
    id,
  },
});

deleteGoalLink.success = (goalLink) => ({
  type: ActionTypes.GOAL_LINK_DELETE__SUCCESS,
  payload: {
    goalLink,
  },
});

deleteGoalLink.failure = (id, error) => ({
  type: ActionTypes.GOAL_LINK_DELETE__FAILURE,
  payload: {
    id,
    error,
  },
});

const handleGoalLinkDelete = (goalLink) => ({
  type: ActionTypes.GOAL_LINK_DELETE_HANDLE,
  payload: {
    goalLink,
  },
});

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
