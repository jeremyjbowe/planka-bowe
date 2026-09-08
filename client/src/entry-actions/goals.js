/*!
 * DTP fork — goal entry actions (the only thing the UI dispatches).
 */

import EntryActionTypes from '../constants/EntryActionTypes';

const createGoal = (data) => ({
  type: EntryActionTypes.GOAL_CREATE,
  payload: {
    data,
  },
});

const handleGoalCreate = (goal) => ({
  type: EntryActionTypes.GOAL_CREATE_HANDLE,
  payload: {
    goal,
  },
});

const updateGoal = (id, data) => ({
  type: EntryActionTypes.GOAL_UPDATE,
  payload: {
    id,
    data,
  },
});

const handleGoalUpdate = (goal) => ({
  type: EntryActionTypes.GOAL_UPDATE_HANDLE,
  payload: {
    goal,
  },
});

const deleteGoal = (id) => ({
  type: EntryActionTypes.GOAL_DELETE,
  payload: {
    id,
  },
});

const handleGoalDelete = (goal) => ({
  type: EntryActionTypes.GOAL_DELETE_HANDLE,
  payload: {
    goal,
  },
});

// data: { cardId } or { boardId }
const createGoalLink = (goalId, data) => ({
  type: EntryActionTypes.GOAL_LINK_CREATE,
  payload: {
    goalId,
    data,
  },
});

const handleGoalLinkCreate = (goalLink, included) => ({
  type: EntryActionTypes.GOAL_LINK_CREATE_HANDLE,
  payload: {
    goalLink,
    included,
  },
});

const handleGoalLinkUpdate = (goalLink, included) => ({
  type: EntryActionTypes.GOAL_LINK_UPDATE_HANDLE,
  payload: {
    goalLink,
    included,
  },
});

const deleteGoalLink = (id) => ({
  type: EntryActionTypes.GOAL_LINK_DELETE,
  payload: {
    id,
  },
});

const handleGoalLinkDelete = (goalLink) => ({
  type: EntryActionTypes.GOAL_LINK_DELETE_HANDLE,
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
