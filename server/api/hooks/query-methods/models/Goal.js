/*!
 * DTP fork — query methods for goals.
 */

const defaultFind = (criteria) => Goal.find(criteria).sort(['position', 'id']);

const createOne = (values) => Goal.create({ ...values }).fetch();

const getAll = () => defaultFind({});

const getByIds = (ids) => defaultFind(ids);

const getByParentGoalId = (parentGoalId) => defaultFind({ parentGoalId });

const getOneById = (id) => Goal.findOne(id);

const update = (criteria, values) =>
  Goal.update(criteria)
    .set({ ...values })
    .fetch();

const updateOne = (criteria, values) => Goal.updateOne(criteria).set({ ...values });

const deleteOne = (criteria) => Goal.destroyOne(criteria);

module.exports = {
  createOne,
  getAll,
  getByIds,
  getByParentGoalId,
  getOneById,
  update,
  updateOne,
  deleteOne,
};
