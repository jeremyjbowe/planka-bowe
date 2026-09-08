/*!
 * DTP fork — saved views.
 */

module.exports = {
  inputs: {
    record: {
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
    const savedView = await SavedView.qm.deleteOne(inputs.record.id);

    if (savedView) {
      sails.helpers.savedViews.broadcastOne(
        savedView,
        'savedViewDelete',
        undefined,
        inputs.request,
      );
    }

    return savedView;
  },
};
