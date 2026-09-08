/*!
 * DTP fork — saved views.
 *
 * `saved_view.data` is a filter preset written and read by the client. The
 * server does not interpret it, but it does keep it well-formed so a bad
 * client cannot poison a board for everybody else.
 */

const { isId } = require('./validators');

const VIEWS = ['kanban', 'grid', 'list', 'table', 'timeline'];
const DUE_FILTERS = ['overdue', 'today', 'thisWeek', 'noDate'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'done'];

const MAX_SEARCH_LENGTH = 128;
const MAX_IDS = 100;

const isIdArray = (value) =>
  _.isArray(value) &&
  value.length <= MAX_IDS &&
  _.every(value, (item) => _.isString(item) && isId(item));

const isEnumArray = (value, allowed) =>
  _.isArray(value) &&
  value.length <= allowed.length &&
  _.every(value, (item) => allowed.includes(item));

const isNullOrOneOf = (value, allowed) => _.isNull(value) || allowed.includes(value);

const isSavedViewData = (value) => {
  if (!_.isPlainObject(value)) {
    return false;
  }

  const keys = Object.keys(value);

  const knownKeys = [
    'view',
    'search',
    'filterUserIds',
    'filterLabelIds',
    'filterDue',
    'filterPriorities',
    'filterStatus',
    'filterAssignedToMe',
  ];

  if (_.difference(keys, knownKeys).length > 0) {
    return false;
  }

  if (!_.isUndefined(value.view) && !VIEWS.includes(value.view)) {
    return false;
  }

  if (
    !_.isUndefined(value.search) &&
    (!_.isString(value.search) || value.search.length > MAX_SEARCH_LENGTH)
  ) {
    return false;
  }

  if (!_.isUndefined(value.filterUserIds) && !isIdArray(value.filterUserIds)) {
    return false;
  }

  if (!_.isUndefined(value.filterLabelIds) && !isIdArray(value.filterLabelIds)) {
    return false;
  }

  if (!_.isUndefined(value.filterDue) && !isNullOrOneOf(value.filterDue, DUE_FILTERS)) {
    return false;
  }

  if (!_.isUndefined(value.filterPriorities) && !isEnumArray(value.filterPriorities, PRIORITIES)) {
    return false;
  }

  if (!_.isUndefined(value.filterStatus) && !isNullOrOneOf(value.filterStatus, STATUSES)) {
    return false;
  }

  if (!_.isUndefined(value.filterAssignedToMe) && !_.isBoolean(value.filterAssignedToMe)) {
    return false;
  }

  return true;
};

module.exports = {
  VIEWS,
  DUE_FILTERS,
  PRIORITIES,
  STATUSES,

  isSavedViewData,
};
