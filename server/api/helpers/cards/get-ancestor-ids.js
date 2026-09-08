/*!
 * DTP fork — subtasks.
 *
 * Walks up the parent chain of a card and returns the ids of every ancestor,
 * nearest first. Bounded so a corrupted cycle can never hang a request.
 */

const MAX_DEPTH = 64;

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const ancestorIds = [];
    let { parentCardId } = inputs.record;

    while (parentCardId && ancestorIds.length < MAX_DEPTH) {
      if (ancestorIds.includes(parentCardId)) {
        break;
      }

      ancestorIds.push(parentCardId);

      // eslint-disable-next-line no-await-in-loop
      const parentCard = await Card.qm.getOneById(parentCardId);

      parentCardId = parentCard ? parentCard.parentCardId : null;
    }

    return ancestorIds;
  },
};
