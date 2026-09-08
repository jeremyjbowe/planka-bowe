/*!
 * DTP fork — PATCH /api/goals/:id
 */

const { isDueDate } = require('../../../utils/validators');
const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  GOAL_NOT_FOUND: {
    goalNotFound: 'Goal not found',
  },
  PARENT_GOAL_NOT_FOUND: {
    parentGoalNotFound: 'Parent goal not found',
  },
  PARENT_GOAL_MUST_NOT_BE_ITSELF_OR_DESCENDANT: {
    parentGoalMustNotBeItselfOrDescendant: 'Parent goal must not be itself or descendant',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
    parentGoalId: {
      ...idInput,
      allowNull: true,
    },
    ownerUserId: idInput,
    name: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 256,
    },
    description: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 4096,
      allowNull: true,
    },
    status: {
      type: 'string',
      isIn: Object.values(Goal.Statuses),
    },
    targetDate: {
      type: 'string',
      custom: isDueDate,
      allowNull: true,
    },
    progress: {
      type: 'number',
      min: 0,
      max: 100,
      allowNull: true,
    },
    position: {
      type: 'number',
      min: 0,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    goalNotFound: {
      responseType: 'notFound',
    },
    parentGoalNotFound: {
      responseType: 'notFound',
    },
    parentGoalMustNotBeItselfOrDescendant: {
      responseType: 'unprocessableEntity',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    let goal = await Goal.qm.getOneById(inputs.id);

    if (!goal) {
      throw Errors.GOAL_NOT_FOUND;
    }

    const isOwner = goal.ownerUserId === currentUser.id;

    if (!isOwner && currentUser.role !== User.Roles.ADMIN) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    let nextParentGoal;
    if (inputs.parentGoalId) {
      nextParentGoal = await Goal.qm.getOneById(inputs.parentGoalId);

      if (!nextParentGoal) {
        throw Errors.PARENT_GOAL_NOT_FOUND;
      }

      const chainIds = [
        nextParentGoal.id,
        ...(await sails.helpers.goals.getAncestorIds(nextParentGoal)),
      ];

      if (chainIds.includes(goal.id)) {
        throw Errors.PARENT_GOAL_MUST_NOT_BE_ITSELF_OR_DESCENDANT;
      }
    }

    if (inputs.ownerUserId) {
      const owner = await User.qm.getOneById(inputs.ownerUserId);

      if (!owner) {
        throw Errors.NOT_ENOUGH_RIGHTS;
      }
    }

    const values = _.pick(inputs, [
      'ownerUserId',
      'name',
      'description',
      'status',
      'targetDate',
      'progress',
      'position',
    ]);

    goal = await sails.helpers.goals.updateOne.with({
      record: goal,
      values: {
        ...values,
        ...(!_.isUndefined(inputs.parentGoalId) && {
          parentGoal: nextParentGoal || null,
        }),
      },
      actorUser: currentUser,
      request: this.req,
    });

    if (!goal) {
      throw Errors.GOAL_NOT_FOUND;
    }

    return {
      item: goal,
    };
  },
};
