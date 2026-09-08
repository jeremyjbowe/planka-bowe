/*!
 * DTP fork — Goals. Boards the user may read: boards of projects they manage,
 * boards they are a member of and, for admins, boards of shared projects.
 * Used to filter the card/board summaries returned with goals.
 */

module.exports = {
  inputs: {
    user: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const managerProjectIds = await sails.helpers.users.getManagerProjectIds(inputs.user.id);
    const fullyVisibleProjectIds = [...managerProjectIds];

    if (inputs.user.role === User.Roles.ADMIN) {
      const sharedProjects = await Project.qm.getShared({
        exceptIdOrIds: managerProjectIds,
      });

      fullyVisibleProjectIds.push(...sails.helpers.utils.mapRecords(sharedProjects));
    }

    const boards = await Board.qm.getByProjectIds(fullyVisibleProjectIds);
    const boardMemberships = await BoardMembership.qm.getByUserId(inputs.user.id);

    return _.union(
      sails.helpers.utils.mapRecords(boards),
      sails.helpers.utils.mapRecords(boardMemberships, 'boardId'),
    );
  },
};
