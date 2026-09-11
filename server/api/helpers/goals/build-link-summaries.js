/*!
 * planka-bowe — Goals. Resolves the cards and boards behind a set of links into
 * small summaries the client can render and compute progress from, limited
 * to boards the user may see.
 */

module.exports = {
  inputs: {
    goalLinks: {
      type: 'ref',
      required: true,
    },
    user: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const visibleBoardIds = await sails.helpers.goals.getVisibleBoardIdsForUser(inputs.user);
    const visibleBoardIdsSet = new Set(visibleBoardIds);

    const cardIds = sails.helpers.utils.mapRecords(inputs.goalLinks, 'cardId', true, true);
    const boardIds = sails.helpers.utils.mapRecords(inputs.goalLinks, 'boardId', true, true);

    const cards = cardIds.length > 0 ? await Card.qm.getByIds(cardIds) : [];

    const cardSummaries = cards
      .filter((card) => visibleBoardIdsSet.has(card.boardId))
      .map((card) => ({
        ..._.pick(card, ['id', 'name', 'isClosed', 'boardId', 'listId', 'dueDate', 'priority']),
      }));

    const boards = boardIds.length > 0 ? await Board.qm.getByIds(boardIds) : [];
    const visibleBoards = boards.filter((board) => visibleBoardIdsSet.has(board.id));

    const boardSummaries = await Promise.all(
      visibleBoards.map(async (board) => {
        const lists = await List.qm.getByBoardId(board.id, {
          typeOrTypes: List.FINITE_TYPES,
        });

        const boardCards = await Card.qm.getByListIds(sails.helpers.utils.mapRecords(lists));

        return {
          ..._.pick(board, ['id', 'name', 'projectId']),
          cardsTotal: boardCards.length,
          closedCardsTotal: boardCards.filter((card) => card.isClosed).length,
        };
      }),
    );

    return {
      cards: cardSummaries,
      boards: boardSummaries,
    };
  },
};
