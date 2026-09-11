/*!
 * planka-bowe — Goals.
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    values: {
      type: 'json',
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

    if (!_.isUndefined(values.parentGoal)) {
      const nextParentGoalId = values.parentGoal ? values.parentGoal.id : null;

      if (nextParentGoalId !== inputs.record.parentGoalId) {
        values.parentGoalId = nextParentGoalId;
      }

      delete values.parentGoal;
    }

    let goal;
    if (_.isEmpty(values)) {
      goal = inputs.record;
    } else {
      goal = await Goal.qm.updateOne(inputs.record.id, values);

      if (!goal) {
        return goal;
      }

      sails.sockets.blast(
        'goalUpdate',
        {
          item: goal,
        },
        inputs.request,
      );
    }

    return goal;
  },
};
