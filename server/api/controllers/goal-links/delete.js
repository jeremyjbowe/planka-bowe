/*!
 * planka-bowe — DELETE /api/goal-links/:id
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  GOAL_LINK_NOT_FOUND: {
    goalLinkNotFound: 'Goal link not found',
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
    goalLinkNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    let goalLink = await GoalLink.qm.getOneById(inputs.id);

    if (!goalLink) {
      throw Errors.GOAL_LINK_NOT_FOUND;
    }

    const goal = await Goal.qm.getOneById(goalLink.goalId);
    const isGoalOwner = !!goal && goal.ownerUserId === currentUser.id;

    if (!isGoalOwner && currentUser.role !== User.Roles.ADMIN) {
      let board;

      if (goalLink.cardId) {
        const card = await Card.qm.getOneById(goalLink.cardId);
        board = card && (await Board.qm.getOneById(card.boardId));
      } else {
        board = await Board.qm.getOneById(goalLink.boardId);
      }

      const canLink = board && (await sails.helpers.goalLinks.canUserLinkBoard(currentUser, board));

      if (!canLink) {
        throw Errors.NOT_ENOUGH_RIGHTS;
      }
    }

    goalLink = await sails.helpers.goalLinks.deleteOne.with({
      record: goalLink,
      request: this.req,
    });

    if (!goalLink) {
      throw Errors.GOAL_LINK_NOT_FOUND;
    }

    return {
      item: goalLink,
    };
  },
};
