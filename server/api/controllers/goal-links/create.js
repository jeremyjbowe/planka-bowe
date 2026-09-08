/*!
 * DTP fork — POST /api/goals/:goalId/goal-links   { cardId | boardId }
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  GOAL_NOT_FOUND: {
    goalNotFound: 'Goal not found',
  },
  CARD_NOT_FOUND: {
    cardNotFound: 'Card not found',
  },
  BOARD_NOT_FOUND: {
    boardNotFound: 'Board not found',
  },
  TARGET_MUST_BE_PRESENT: {
    targetMustBePresent: 'Exactly one of cardId or boardId must be present',
  },
  GOAL_LINK_ALREADY_EXISTS: {
    goalLinkAlreadyExists: 'Goal link already exists',
  },
};

module.exports = {
  inputs: {
    goalId: {
      ...idInput,
      required: true,
    },
    cardId: idInput,
    boardId: idInput,
  },

  exits: {
    notEnoughRights: {
      responseType: 'forbidden',
    },
    goalNotFound: {
      responseType: 'notFound',
    },
    cardNotFound: {
      responseType: 'notFound',
    },
    boardNotFound: {
      responseType: 'notFound',
    },
    targetMustBePresent: {
      responseType: 'unprocessableEntity',
    },
    goalLinkAlreadyExists: {
      responseType: 'conflict',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    if (!!inputs.cardId === !!inputs.boardId) {
      throw Errors.TARGET_MUST_BE_PRESENT;
    }

    const goal = await Goal.qm.getOneById(inputs.goalId);

    if (!goal) {
      throw Errors.GOAL_NOT_FOUND;
    }

    let card;
    let board;

    if (inputs.cardId) {
      card = await Card.qm.getOneById(inputs.cardId);

      if (!card) {
        throw Errors.CARD_NOT_FOUND;
      }

      board = await Board.qm.getOneById(card.boardId);

      if (!board) {
        throw Errors.CARD_NOT_FOUND;
      }
    } else {
      board = await Board.qm.getOneById(inputs.boardId);

      if (!board) {
        throw Errors.BOARD_NOT_FOUND;
      }
    }

    const canLink = await sails.helpers.goalLinks.canUserLinkBoard(currentUser, board);

    if (!canLink) {
      throw Errors.NOT_ENOUGH_RIGHTS;
    }

    const { goalLink, summaries } = await sails.helpers.goalLinks.createOne
      .with({
        values: {
          goal,
          card,
          board: card ? undefined : board,
        },
        actorUser: currentUser,
        request: this.req,
      })
      .intercept('alreadyExists', () => Errors.GOAL_LINK_ALREADY_EXISTS);

    return {
      item: goalLink,
      included: summaries,
    };
  },
};
