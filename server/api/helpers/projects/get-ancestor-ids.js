/*!
 * planka-bowe — hierarchical projects.
 *
 * Returns the ids of every ancestor of a project, nearest first. Bounded so a
 * corrupted cycle can never hang a request.
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
    let { parentProjectId } = inputs.record;

    while (parentProjectId && ancestorIds.length < MAX_DEPTH) {
      if (ancestorIds.includes(parentProjectId)) {
        break;
      }

      ancestorIds.push(parentProjectId);

      // eslint-disable-next-line no-await-in-loop
      const parentProject = await Project.qm.getOneById(parentProjectId);

      parentProjectId = parentProject ? parentProject.parentProjectId : null;
    }

    return ancestorIds;
  },
};
