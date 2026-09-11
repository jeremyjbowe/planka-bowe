/*!
 * planka-bowe — Goals. Ancestor ids of a goal, nearest first, bounded.
 */

const MAX_DEPTH = 32;

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const ancestorIds = [];
    let { parentGoalId } = inputs.record;

    while (parentGoalId && ancestorIds.length < MAX_DEPTH) {
      if (ancestorIds.includes(parentGoalId)) {
        break;
      }

      ancestorIds.push(parentGoalId);

      // eslint-disable-next-line no-await-in-loop
      const parentGoal = await Goal.qm.getOneById(parentGoalId);

      parentGoalId = parentGoal ? parentGoal.parentGoalId : null;
    }

    return ancestorIds;
  },
};
