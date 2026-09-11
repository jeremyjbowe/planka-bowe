/*!
 * planka-bowe — saved views.
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    values: {
      type: 'json',
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
    const savedView = await SavedView.qm.updateOne(inputs.record.id, inputs.values);

    if (savedView) {
      sails.helpers.savedViews.broadcastOne(
        savedView,
        'savedViewUpdate',
        inputs.record,
        inputs.request,
      );
    }

    return savedView;
  },
};
