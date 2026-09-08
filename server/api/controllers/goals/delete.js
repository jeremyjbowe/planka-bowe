/*!
 * DTP fork — DELETE /api/goals/:id
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  GOAL_NOT_FOUND: {
    goalNotFound: 'Goal not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    goalNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    let goal = await Goal.qm.getOneById(inputs.id);

    if (!goal) {
      throw Errors.GOAL_NOT_FOUND;
    }

    if (goal.ownerUserId !== currentUser.id && currentUser.role !== User.Roles.ADMIN) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    goal = await sails.helpers.goals.deleteOne.with({
      record: goal,
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
