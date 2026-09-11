/*!
 * planka-bowe — Goals. A user may link a board (or its cards) when they are an
 * editor member of the board or manage its project.
 */

module.exports = {
  inputs: {
    user: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
      inputs.board.id,
      inputs.user.id,
    );

    if (boardMembership && boardMembership.role === BoardMembership.Roles.EDITOR) {
      return true;
    }

    return sails.helpers.users.isProjectManager(inputs.user.id, inputs.board.projectId);
  },
};
