/*!
 * planka-bowe — Goals.
 */

const POSITION_GAP = 65536;

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

  async fn(inputs) {
    const { values } = inputs;

    const goals = await Goal.qm.getAll();
    const lastGoal = goals[goals.length - 1];

    const goal = await Goal.qm.createOne({
      status: Goal.Statuses.ACTIVE,
      ...values,
      ownerUserId: values.ownerUserId || inputs.actorUser.id,
      position: lastGoal ? lastGoal.position + POSITION_GAP : POSITION_GAP,
    });

    // Goals are global, so every connected client is told.
    sails.sockets.blast(
      'goalCreate',
      {
        item: goal,
      },
      inputs.request,
    );

    return goal;
  },
};
