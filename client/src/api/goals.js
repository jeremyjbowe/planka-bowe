/*!
 * planka-bowe — goals API.
 */

import socket from './socket';

/* Transformers */

export const transformGoal = (goal) => ({
  ...goal,
  ...(goal.targetDate && {
    targetDate: new Date(goal.targetDate),
  }),
});

export const transformGoalData = (data) => ({
  ...data,
  ...(data.targetDate && {
    targetDate: data.targetDate.toISOString(),
  }),
});

/* Actions */

const getGoals = (headers) =>
  socket.get('/goals', undefined, headers).then((body) => ({
    ...body,
    items: body.items.map(transformGoal),
  }));

const createGoal = (data, headers) =>
  socket.post('/goals', transformGoalData(data), headers).then((body) => ({
    ...body,
    item: transformGoal(body.item),
  }));

const updateGoal = (id, data, headers) =>
  socket.patch(`/goals/${id}`, transformGoalData(data), headers).then((body) => ({
    ...body,
    item: transformGoal(body.item),
  }));

const deleteGoal = (id, headers) =>
  socket.delete(`/goals/${id}`, undefined, headers).then((body) => ({
    ...body,
    item: transformGoal(body.item),
  }));

const createGoalLink = (goalId, data, headers) =>
  socket.post(`/goals/${goalId}/goal-links`, data, headers);

const deleteGoalLink = (id, headers) => socket.delete(`/goal-links/${id}`, undefined, headers);

export default {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  createGoalLink,
  deleteGoalLink,
};
