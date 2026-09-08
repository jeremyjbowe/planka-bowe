/*!
 * DTP fork — hierarchical projects.
 *
 * Clears `parentProjectId` on every child of a project (used before the
 * parent is deleted) and tells everyone who can see a child about it.
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const projects = await Project.qm.update(
      {
        parentProjectId: inputs.record.id,
      },
      {
        parentProjectId: null,
      },
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const project of projects) {
      const scoper = sails.helpers.projects.makeScoper.with({
        record: project,
      });

      // eslint-disable-next-line no-await-in-loop
      const projectRelatedUserIds = await scoper.getProjectRelatedUserIds();

      projectRelatedUserIds.forEach((userId) => {
        sails.sockets.broadcast(
          `user:${userId}`,
          'projectUpdate',
          {
            item: project,
          },
          inputs.request,
        );
      });
    }

    return projects;
  },
};
