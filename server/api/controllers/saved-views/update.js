/*!
 * DTP fork — PATCH /api/saved-views/:id
 */

const { isSavedViewData } = require('../../../utils/saved-view-data');
const { idInput } = require('../../../utils/inputs');

const Errors = {
  NOT_ENOUGH_RIGHTS: {
    notEnoughRights: 'Not enough rights',
  },
  SAVED_VIEW_NOT_FOUND: {
    savedViewNotFound: 'Saved view not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
    name: {
      type: 'string',
      isNotEmptyString: true,
      maxLength: 128,
    },
    isShared: {
      type: 'boolean',
    },
    data: {
      type: 'json',
      custom: isSavedViewData,
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
    savedViewNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const pathToProject = await sails.helpers.savedViews
      .getPathToProjectById(inputs.id)
      .intercept('pathNotFound', () => Errors.SAVED_VIEW_NOT_FOUND);

    let { savedView } = pathToProject;
    const { board, project } = pathToProject;

    const isProjectManager = await sails.helpers.users.isProjectManager(currentUser.id, project.id);

    if (!isProjectManager) {
      const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
        board.id,
        currentUser.id,
      );

      if (!boardMembership) {
        throw Errors.SAVED_VIEW_NOT_FOUND; // Forbidden
      }

      // A personal view of somebody else does not exist as far as this user
      // is concerned.
      if (!savedView.isShared && savedView.creatorUserId !== currentUser.id) {
        throw Errors.SAVED_VIEW_NOT_FOUND; // Forbidden
      }

      if (savedView.creatorUserId !== currentUser.id) {
        throw Errors.NOT_ENOUGH_RIGHTS;
      }
    }

    const values = _.pick(inputs, ['name', 'isShared', 'data', 'position']);

    savedView = await sails.helpers.savedViews.updateOne.with({
      record: savedView,
      values,
      actorUser: currentUser,
      request: this.req,
    });

    if (!savedView) {
      throw Errors.SAVED_VIEW_NOT_FOUND;
    }

    return {
      item: savedView,
    };
  },
};
