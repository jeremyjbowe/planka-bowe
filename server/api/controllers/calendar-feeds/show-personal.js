/*!
 * DTP fork — GET /feeds/:token/todos.ics[?mode=events]
 * Cards the user is a member of, across the boards they can see. Public
 * route authenticated by the secret token only.
 */

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
    const visibleBoardIdsSet = new Set(visibleBoardIds);

    const cardMemberships = await CardMembership.qm.getByUserId(user.id);
    const cardIds = sails.helpers.utils.mapRecords(cardMemberships, 'cardId', true);

    const cards = (cardIds.length > 0 ? await Card.qm.getByIds(cardIds) : []).filter((card) =>
      visibleBoardIdsSet.has(card.boardId),
    );

    const lookups = await sails.helpers.calendarFeeds.collectCards.with({ cards });

    const ics = sails.helpers.calendarFeeds.buildIcs.with({
      name: `PLANKA — ${user.name}`,
      cards,
      mode: inputs.mode,
      ...lookups,
    });

    this.res.set('Content-Type', 'text/calendar; charset=utf-8');
    this.res.set('Content-Disposition', 'inline; filename="my-cards.ics"');
    this.res.set('Cache-Control', 'private, max-age=60');

    return this.res.send(ics);
  },
};
