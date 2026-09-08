/*!
 * DTP fork — Goals. Pushes fresh link summaries (card completion, board
 * totals) to the users who may see the board, so goal progress stays live
 * everywhere without leaking names to users outside the project.
 */

module.exports = {
  inputs: {
    board: {
      type: 'ref',
      required: true,
    },
    cardIds: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const boardLinks = await GoalLink.qm.getByBoardId(inputs.board.id);
    const cardLinks =
      inputs.cardIds && inputs.cardIds.length > 0
        ? await GoalLink.qm.getByCardIds(inputs.cardIds)
        : [];

    if (boardLinks.length === 0 && cardLinks.length === 0) {
      return;
    }

    const project = await Project.qm.getOneById(inputs.board.projectId);

    if (!project) {
      return;
    }

    const scoper = sails.helpers.projects.makeScoper.with({
      record: project,
    });

    const userIds = await scoper.getProjectRelatedUserIds();

    let boardSummary;
    if (boardLinks.length > 0) {
      const lists = await List.qm.getByBoardId(inputs.board.id, {
        typeOrTypes: List.FINITE_TYPES,
      });

      const boardCards = await Card.qm.getByListIds(sails.helpers.utils.mapRecords(lists));

      boardSummary = {
        ..._.pick(inputs.board, ['id', 'name', 'projectId']),
        cardsTotal: boardCards.length,
        closedCardsTotal: boardCards.filter((card) => card.isClosed).length,
      };
    }

    const cards =
      cardLinks.length > 0
        ? await Card.qm.getByIds(sails.helpers.utils.mapRecords(cardLinks, 'cardId', true))
        : [];

    const cardSummaries = cards.map((card) =>
      _.pick(card, ['id', 'name', 'isClosed', 'boardId', 'listId', 'dueDate', 'priority']),
    );

    const emit = (goalLink, included) => {
      userIds.forEach((userId) => {
        sails.sockets.broadcast(`user:${userId}`, 'goalLinkUpdate', {
          item: goalLink,
          included,
        });
      });
    };

    boardLinks.forEach((goalLink) => {
      emit(goalLink, { cards: [], boards: [boardSummary] });
    });

    cardLinks.forEach((goalLink) => {
      emit(goalLink, {
        cards: cardSummaries.filter((card) => card.id === goalLink.cardId),
        boards: [],
      });
    });
  },
};
