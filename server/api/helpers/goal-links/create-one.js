/*!
 * planka-bowe — Goals. Creates a link between a goal and a card or a board and
 * broadcasts it with a fresh summary so every client can update progress.
 */

module.exports = {
  inputs: {
    values: {
      type: 'ref',
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

  exits: {
    alreadyExists: {},
  },

  async fn(inputs) {
    const { values } = inputs;

    let goalLink;
    try {
      goalLink = await GoalLink.qm.createOne({
        goalId: values.goal.id,
        cardId: values.card ? values.card.id : null,
        boardId: values.board ? values.board.id : null,
      });
    } catch (error) {
      if (error.code === 'E_UNIQUE') {
        throw 'alreadyExists';
      }

      throw error;
    }

    const summaries = await sails.helpers.goals.buildLinkSummaries.with({
      goalLinks: [goalLink],
      user: inputs.actorUser,
    });

    // Everyone learns the link exists; only users who may see the board get
    // the target's name and totals.
    sails.sockets.blast(
      'goalLinkCreate',
      {
        item: goalLink,
      },
      inputs.request,
    );

    await sails.helpers.goalLinks.broadcastTargetUpdate.with({
      board: values.board || (await Board.qm.getOneById(values.card.boardId)),
      cardIds: values.card ? [values.card.id] : [],
    });

    return { goalLink, summaries };
  },
};
