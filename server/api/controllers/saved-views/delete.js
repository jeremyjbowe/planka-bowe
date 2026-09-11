/*!
 * planka-bowe — DELETE /api/saved-views/:id
 */

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

      if (!savedView.isShared && savedView.creatorUserId !== currentUser.id) {
        throw Errors.SAVED_VIEW_NOT_FOUND; // Forbidden
      }

      if (savedView.creatorUserId !== currentUser.id) {
        throw Errors.NOT_ENOUGH_RIGHTS;
      }
    }

    savedView = await sails.helpers.savedViews.deleteOne.with({
      record: savedView,
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
