/*!
 * planka-bowe — calendar feeds. Gathers the cards for a feed together with the
 * lookups the serializer needs (labels per card, lists, boards).
 */

module.exports = {
  inputs: {
    cards: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const { cards } = inputs;
    const cardIds = sails.helpers.utils.mapRecords(cards);

    const cardLabels = cardIds.length > 0 ? await CardLabel.qm.getByCardIds(cardIds) : [];
    const labelIds = sails.helpers.utils.mapRecords(cardLabels, 'labelId', true);
    const labels = labelIds.length > 0 ? await Label.qm.getByIds(labelIds) : [];
    const labelById = _.keyBy(labels, 'id');

    const labelsByCardId = cardLabels.reduce((result, cardLabel) => {
      const label = labelById[cardLabel.labelId];

      if (!label || !label.name) {
        return result;
      }

      return {
        ...result,
        [cardLabel.cardId]: [...(result[cardLabel.cardId] || []), label.name],
      };
    }, {});

    const listIds = sails.helpers.utils.mapRecords(cards, 'listId', true);
    const lists = listIds.length > 0 ? await List.qm.getByIds(listIds) : [];

    const boardIds = sails.helpers.utils.mapRecords(cards, 'boardId', true);
    const boards = boardIds.length > 0 ? await Board.qm.getByIds(boardIds) : [];

    return {
      labelsByCardId,
      listById: _.keyBy(lists, 'id'),
      boardById: _.keyBy(boards, 'id'),
    };
  },
};
