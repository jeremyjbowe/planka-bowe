/*!
 * planka-bowe — query methods for goal links.
 */

const defaultFind = (criteria) => GoalLink.find(criteria).sort('id');

const createOne = (values) => GoalLink.create({ ...values }).fetch();

const getAll = () => defaultFind({});

const getByGoalId = (goalId) => defaultFind({ goalId });

const getByGoalIds = (goalIds) => defaultFind({ goalId: goalIds });

const getByCardId = (cardId) => defaultFind({ cardId });

const getByCardIds = (cardIds) => defaultFind({ cardId: cardIds });

const getByBoardId = (boardId) => defaultFind({ boardId });

const getOneById = (id) => GoalLink.findOne(id);

const getOneByGoalIdAndCardId = (goalId, cardId) => GoalLink.findOne({ goalId, cardId });

const getOneByGoalIdAndBoardId = (goalId, boardId) => GoalLink.findOne({ goalId, boardId });

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => GoalLink.destroy(criteria).fetch();

const deleteOne = (criteria) => GoalLink.destroyOne(criteria);

module.exports = {
  createOne,
  getAll,
  getByGoalId,
  getByGoalIds,
  getByCardId,
  getByCardIds,
  getByBoardId,
  getOneById,
  getOneByGoalIdAndCardId,
  getOneByGoalIdAndBoardId,
  deleteOne,
  delete: delete_,
};
