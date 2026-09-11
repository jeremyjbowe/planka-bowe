/*!
 * planka-bowe — POST /api/goals
 */

const { isDueDate } = require('../../../utils/validators');
const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  PARENT_GOAL_NOT_FOUND: {
    parentGoalNotFound: 'Parent goal not found',
  },
};

module.exports = {
  inputs: {
    parentGoalId: idInput,
    name: {
      type: 'string',
      maxLength: 256,
      required: true,
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
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    parentGoalNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    if (![User.Roles.ADMIN, User.Roles.PROJECT_OWNER].includes(currentUser.role)) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    if (inputs.parentGoalId) {
      const parentGoal = await Goal.qm.getOneById(inputs.parentGoalId);

      if (!parentGoal) {
        throw Errors.PARENT_GOAL_NOT_FOUND;
      }
    }

    const values = _.pick(inputs, [
      'parentGoalId',
      'name',
      'description',
      'status',
      'targetDate',
      'progress',
    ]);

    const goal = await sails.helpers.goals.createOne.with({
      values,
      actorUser: currentUser,
      request: this.req,
    });

    return {
      item: goal,
    };
  },
};
