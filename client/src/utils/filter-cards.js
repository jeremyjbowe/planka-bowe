/*!
 * DTP fork — board filtering.
 *
 * `Board#getFilteredCardsModelArray` and `List#getFilteredCardsModelArray`
 * both run the exact same predicate chain, so it lives here once. Everything
 * it reads is client-only state on the Board model (see `models/Board.js`).
 *
 * Semantics:
 *  - search        — every whitespace-separated part must appear in the name
 *                    or description; `/…` is a case-insensitive regexp
 *  - members       — OR over card members and task assignees
 *  - labels        — OR over card labels
 *  - due           — one of overdue / today / thisWeek / noDate
 *  - priorities    — OR over card priorities
 *  - status        — open (not closed) / done (closed)
 *  - assignedToMe  — the current user is a member of the card
 *
 * Dimensions are combined with AND.
 */

import { endOfDay, endOfWeek, startOfDay, startOfWeek } from 'date-fns';

import buildSearchParts from './build-search-parts';
import { CardDueFilters, CardStatusFilters } from '../constants/Enums';

const matchesDue = (cardModel, filterDue) => {
  const { dueDate } = cardModel;

  if (filterDue === CardDueFilters.NO_DATE) {
    return !dueDate;
  }

  if (!dueDate) {
    return false;
  }

  const date = dueDate instanceof Date ? dueDate : new Date(dueDate);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  switch (filterDue) {
    case CardDueFilters.OVERDUE:
      return !cardModel.isDueCompleted && date.getTime() < now.getTime();
    case CardDueFilters.TODAY:
      return date >= startOfDay(now) && date <= endOfDay(now);
    case CardDueFilters.THIS_WEEK:
      return date >= startOfWeek(now) && date <= endOfWeek(now);
    default:
      return true;
  }
};

export default (cardModels, boardModel) => {
  let nextCardModels = cardModels;

  if (nextCardModels.length === 0) {
    return nextCardModels;
  }

  const {
    search,
    filterDue,
    filterPriorities,
    filterStatus,
    filterAssignedToMe,
    filterCurrentUserId,
  } = boardModel;

  if (search) {
    if (search.startsWith('/')) {
      let searchRegex;
      try {
        searchRegex = new RegExp(search.substring(1), 'i');
      } catch {
        return [];
      }

      nextCardModels = nextCardModels.filter(
        (cardModel) =>
          searchRegex.test(cardModel.name) ||
          (cardModel.description && searchRegex.test(cardModel.description)),
      );
    } else {
      const searchParts = buildSearchParts(search);

      nextCardModels = nextCardModels.filter((cardModel) => {
        const name = cardModel.name.toLowerCase();
        const description = cardModel.description && cardModel.description.toLowerCase();

        return searchParts.every(
          (searchPart) =>
            name.includes(searchPart) || (description && description.includes(searchPart)),
        );
      });
    }
  }

  const filterUserIds = boardModel.filterUsers.toRefArray().map((user) => user.id);

  if (filterUserIds.length > 0) {
    nextCardModels = nextCardModels.filter((cardModel) => {
      const users = cardModel.users.toRefArray();

      if (users.some((user) => filterUserIds.includes(user.id))) {
        return true;
      }

      return cardModel
        .getTaskListsQuerySet()
        .toModelArray()
        .some((taskListModel) =>
          taskListModel
            .getTasksQuerySet()
            .toRefArray()
            .some((task) => task.assigneeUserId && filterUserIds.includes(task.assigneeUserId)),
        );
    });
  }

  const filterLabelIds = boardModel.filterLabels.toRefArray().map((label) => label.id);

  if (filterLabelIds.length > 0) {
    nextCardModels = nextCardModels.filter((cardModel) => {
      const labels = cardModel.labels.toRefArray();
      return labels.some((label) => filterLabelIds.includes(label.id));
    });
  }

  if (filterDue) {
    nextCardModels = nextCardModels.filter((cardModel) => matchesDue(cardModel, filterDue));
  }

  if (filterPriorities && filterPriorities.length > 0) {
    nextCardModels = nextCardModels.filter(
      (cardModel) => cardModel.priority && filterPriorities.includes(cardModel.priority),
    );
  }

  if (filterStatus) {
    const shouldBeClosed = filterStatus === CardStatusFilters.DONE;
    nextCardModels = nextCardModels.filter((cardModel) => !!cardModel.isClosed === shouldBeClosed);
  }

  if (filterAssignedToMe && filterCurrentUserId) {
    nextCardModels = nextCardModels.filter((cardModel) =>
      cardModel.users.toRefArray().some((user) => user.id === filterCurrentUserId),
    );
  }

  return nextCardModels;
};
