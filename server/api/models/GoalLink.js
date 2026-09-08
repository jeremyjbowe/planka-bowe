/*!
 * DTP fork — GoalLink.js
 *
 * Joins a goal to exactly one card or one board.
 */

module.exports = {
  attributes: {
    goalId: {
      model: 'Goal',
      required: true,
      columnName: 'goal_id',
    },
    cardId: {
      model: 'Card',
      columnName: 'card_id',
    },
    boardId: {
      model: 'Board',
      columnName: 'board_id',
    },
  },

  tableName: 'goal_link',
};
