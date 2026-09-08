/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    list: {
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

  async fn(inputs) {
    // DTP fork — subtasks: children survive as top-level cards
    await sails.helpers.cards.detachSubtasks.with({
      record: inputs.record,
      request: inputs.request,
    });

    await sails.helpers.cards.deleteRelated(inputs.record);

    // DTP fork — goals
    await sails.helpers.goalLinks.deleteByTarget.with({
      cardId: inputs.record.id,
    });

    const card = await Card.qm.deleteOne(inputs.record.id);

    // DTP fork — goals: board totals changed
    await sails.helpers.goalLinks.broadcastTargetUpdate.with({
      board: inputs.board,
    });

    if (card) {
      sails.sockets.broadcast(
        `board:${card.boardId}`,
        'cardDelete',
        {
          item: card,
        },
        inputs.request,
      );

      const webhooks = await Webhook.qm.getAll();

      sails.helpers.utils.sendWebhooks.with({
        webhooks,
        event: Webhook.Events.CARD_DELETE,
        buildData: () => ({
          item: card,
          included: {
            projects: [inputs.project],
            boards: [inputs.board],
            lists: [inputs.list],
          },
        }),
        user: inputs.actorUser,
      });
    }

    return card;
  },
};
