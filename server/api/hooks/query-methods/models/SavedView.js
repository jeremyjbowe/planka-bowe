/*!
 * DTP fork — query methods for saved views.
 */

const defaultFind = (criteria, { sort = ['position', 'id'] } = {}) =>
  SavedView.find(criteria).sort(sort);

/* Query methods */

const createOne = (values) => SavedView.create({ ...values }).fetch();

const getByIds = (ids) => defaultFind(ids);

const getByBoardId = (boardId) => defaultFind({ boardId });

// Shared views plus the given user's own personal ones.
const getByBoardIdForUser = (boardId, userId) =>
  defaultFind({
    boardId,
    or: [{ isShared: true }, { creatorUserId: userId }],
  });

const getOneById = (id, { boardId } = {}) => {
  const criteria = { id };

  if (boardId) {
    criteria.boardId = boardId;
  }

  return SavedView.findOne(criteria);
};

const updateOne = (criteria, values) => SavedView.updateOne(criteria).set({ ...values });

// eslint-disable-next-line no-underscore-dangle
const delete_ = (criteria) => SavedView.destroy(criteria).fetch();

const deleteOne = (criteria) => SavedView.destroyOne(criteria);

module.exports = {
  createOne,
  getByIds,
  getByBoardId,
  getByBoardIdForUser,
  getOneById,
  updateOne,
  deleteOne,
  delete: delete_,
};
