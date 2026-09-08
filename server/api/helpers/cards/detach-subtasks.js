/*!
 * DTP fork — subtasks.
 *
 * Clears `parentCardId` on every child of a card and broadcasts the change,
 * used when the parent is deleted or moved to another board.
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
    const { cards } = await Card.qm.update(
      {
        parentCardId: inputs.record.id,
      },
      {
        parentCardId: null,
      },
    );

    cards.forEach((card) => {
      sails.sockets.broadcast(
        `board:${card.boardId}`,
        'cardUpdate',
        {
          item: card,
        },
        inputs.request,
      );
    });

    return cards;
  },
};
