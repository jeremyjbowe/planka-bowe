/*!
 * DTP fork — Goals. Children become top-level goals; links are removed.
 */

module.exports = {
  inputs: {
    record: {
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
    const children = await Goal.qm.update(
      {
        parentGoalId: inputs.record.id,
      },
      {
        parentGoalId: null,
      },
    );

    children.forEach((child) => {
      sails.sockets.blast('goalUpdate', {
        item: child,
      });
    });

    await GoalLink.qm.delete({
      goalId: inputs.record.id,
    });

    const goal = await Goal.qm.deleteOne(inputs.record.id);

    if (goal) {
      sails.sockets.blast(
        'goalDelete',
        {
          item: goal,
        },
        inputs.request,
      );
    }

    return goal;
  },
};
