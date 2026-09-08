/*!
 * DTP fork — Goals. Removes every link pointing at a deleted card or board.
 */

module.exports = {
  inputs: {
    cardId: {
      type: 'string',
    },
    boardId: {
      type: 'string',
    },
  },

  async fn(inputs) {
    const criteria = {};

    if (inputs.cardId) {
      criteria.cardId = inputs.cardId;
    } else if (inputs.boardId) {
      criteria.boardId = inputs.boardId;
    } else {
      return [];
    }

    const goalLinks = await GoalLink.qm.delete(criteria);

    goalLinks.forEach((goalLink) => {
      sails.sockets.blast('goalLinkDelete', {
        item: goalLink,
      });
    });

    return goalLinks;
  },
};
