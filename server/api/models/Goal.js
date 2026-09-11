/*!
 * planka-bowe — Goal.js
 *
 * A global goal (OKR-style objective). Progress is derived from linked cards
 * and boards; `progress` is only used when the goal has no links.
 */

const Statuses = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DONE: 'done',
};

module.exports = {
  Statuses,

  attributes: {
    name: {
      type: 'string',
      required: true,
    },
    description: {
      type: 'string',
      isNotEmptyString: true,
      allowNull: true,
    },
    status: {
      type: 'string',
      isIn: Object.values(Statuses),
      required: true,
    },
    targetDate: {
      type: 'ref',
      columnName: 'target_date',
    },
    progress: {
      type: 'number',
      allowNull: true,
    },
    position: {
      type: 'number',
      required: true,
    },

    ownerUserId: {
      model: 'User',
      columnName: 'owner_user_id',
    },
    parentGoalId: {
      model: 'Goal',
      columnName: 'parent_goal_id',
    },
    links: {
      collection: 'GoalLink',
      via: 'goalId',
    },
  },
};
