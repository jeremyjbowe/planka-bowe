/*!
 * DTP fork — Goals.
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const goalLink = await GoalLink.qm.deleteOne(inputs.record.id);

    if (goalLink) {
      sails.sockets.blast(
        'goalLinkDelete',
        {
          item: goalLink,
        },
        inputs.request,
      );
    }

    return goalLink;
  },
};
