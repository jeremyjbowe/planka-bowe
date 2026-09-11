/*!
 * planka-bowe — saved views.
 */

module.exports = {
  inputs: {
    values: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const { values } = inputs;

    const savedViews = await SavedView.qm.getByBoardId(values.board.id);

    const savedView = await SavedView.qm.createOne({
      ..._.omit(values, 'board'),
      boardId: values.board.id,
      position: (savedViews.length + 1) * 65536,
    });

    sails.helpers.savedViews.broadcastOne(savedView, 'savedViewCreate', undefined, inputs.request);

    return savedView;
  },
};
