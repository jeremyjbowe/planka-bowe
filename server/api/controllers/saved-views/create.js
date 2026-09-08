/*!
 * DTP fork — POST /api/boards/:boardId/saved-views
 */

const { isSavedViewData } = require('../../../utils/saved-view-data');
const { idInput } = require('../../../utils/inputs');

const Errors = {
  BOARD_NOT_FOUND: {
    boardNotFound: 'Board not found',
  },
};

module.exports = {
  inputs: {
    boardId: {
      ...idInput,
      required: true,
    },
    name: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 128,
      required: true,
    },
    isShared: {
      type: 'boolean',
    },
    data: {
      type: 'json',
      custom: isSavedViewData,
      required: true,
    },
  },

  exits: {
    boardNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { board, project } = await sails.helpers.boards
      .getPathToProjectById(inputs.boardId)
      .intercept('pathNotFound', () => Errors.BOARD_NOT_FOUND);

    const isProjectManager = await sails.helpers.users.isProjectManager(currentUser.id, project.id);

    if (!isProjectManager) {
      const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
        board.id,
        currentUser.id,
      );

      if (!boardMembership) {
        throw Errors.BOARD_NOT_FOUND; // Forbidden
      }
    }

    const values = _.pick(inputs, ['name', 'isShared', 'data']);

    const savedView = await sails.helpers.savedViews.createOne.with({
      values: {
        ...values,
        board,
        creatorUserId: currentUser.id,
      },
      actorUser: currentUser,
      request: this.req,
    });

    return {
      item: savedView,
    };
  },
};
