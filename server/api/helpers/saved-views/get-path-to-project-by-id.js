/*!
 * DTP fork — saved views.
 */

module.exports = {
  inputs: {
    id: {
      type: 'string',
      required: true,
    },
  },

  exits: {
    pathNotFound: {},
  },

  async fn(inputs) {
    const savedView = await SavedView.qm.getOneById(inputs.id);

    if (!savedView) {
      throw 'pathNotFound';
    }

    const pathToProject = await sails.helpers.boards
      .getPathToProjectById(savedView.boardId)
      .intercept('pathNotFound', (nodes) => ({
        pathNotFound: {
          savedView,
          ...nodes,
        },
      }));

    return {
      savedView,
      ...pathToProject,
    };
  },
};
