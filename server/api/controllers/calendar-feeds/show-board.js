/*!
 * DTP fork — GET /feeds/:token/boards/:boardId/todos.ics[?mode=events]
 * Every card in the board's active and closed lists, if the token's user may
 * see the board.
 */

const { idInput } = require('../../../utils/inputs');

const Errors = {
  FEED_NOT_FOUND: {
    feedNotFound: 'Feed not found',
  },
};

module.exports = {
  inputs: {
    token: {
      type: 'string',
      maxLength: 128,
      required: true,
    },
    boardId: {
      ...idInput,
      required: true,
    },
    mode: {
      type: 'string',
      isIn: ['todos', 'events'],
      defaultsTo: 'todos',
    },
  },

  exits: {
    feedNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const user = await User.qm.getOneByCalendarFeedToken(inputs.token);

    if (!user || user.isDeactivated) {
      throw Errors.FEED_NOT_FOUND;
    }

    const visibleBoardIds = await sails.helpers.goals.getVisibleBoardIdsForUser(user);

    if (!visibleBoardIds.includes(inputs.boardId)) {
      throw Errors.FEED_NOT_FOUND;
    }

    const board = await Board.qm.getOneById(inputs.boardId);

    if (!board) {
      throw Errors.FEED_NOT_FOUND;
    }

    const lists = await List.qm.getByBoardId(board.id, {
      typeOrTypes: List.FINITE_TYPES,
    });

    const cards = await Card.qm.getByListIds(sails.helpers.utils.mapRecords(lists));
    const lookups = await sails.helpers.calendarFeeds.collectCards.with({ cards });

    const ics = sails.helpers.calendarFeeds.buildIcs.with({
      name: `PLANKA — ${board.name}`,
      cards,
      mode: inputs.mode,
      ...lookups,
    });

    this.res.set('Content-Type', 'text/calendar; charset=utf-8');
    this.res.set(
      'Content-Disposition',
      `inline; filename="${board.name.replace(/[^\w.-]+/g, '-').toLowerCase()}.ics"`,
    );
    this.res.set('Cache-Control', 'private, max-age=60');

    return this.res.send(ics);
  },
};
