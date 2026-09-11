/*!
 * planka-bowe — goal selectors.
 *
 * Progress is computed here, from the ORM: card links use the live card when
 * its board is loaded and the server snapshot otherwise; board links use live
 * board cards when loaded, otherwise the snapshot totals; sub-goals count as
 * one unit each with their own progress. A goal without any of those falls
 * back to its manual `progress` value.
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectPath } from './router';
import { selectCurrentUserId } from './users';
import { selectCurrentModal } from './modals';
import { isLocalId } from '../utils/local-id';
import { GoalStatuses } from '../constants/Enums';

const MAX_DEPTH = 8;

const describeLink = (goalLinkModel) => {
  if (goalLinkModel.cardId) {
    const cardModel = goalLinkModel.card;

    if (!cardModel && !goalLinkModel.isTargetVisible) {
      return null;
    }

    return {
      id: goalLinkModel.id,
      goalId: goalLinkModel.goalId,
      type: 'card',
      targetId: goalLinkModel.cardId,
      boardId: cardModel ? cardModel.boardId : goalLinkModel.targetBoardId,
      name: cardModel ? cardModel.name : goalLinkModel.cardName,
      isClosed: cardModel ? cardModel.isClosed : goalLinkModel.cardIsClosed,
      isPersisted: !isLocalId(goalLinkModel.id),
      units: 1,
      done: (cardModel ? cardModel.isClosed : goalLinkModel.cardIsClosed) ? 1 : 0,
    };
  }

  if (goalLinkModel.boardId) {
    const boardModel = goalLinkModel.board;

    if (!boardModel && !goalLinkModel.isTargetVisible) {
      return null;
    }

    let cardsTotal = goalLinkModel.boardCardsTotal;
    let closedCardsTotal = goalLinkModel.boardClosedCardsTotal;

    if (boardModel && boardModel.isFetching === false) {
      const cardModels = boardModel.getCardsModelArray();
      cardsTotal = cardModels.length;
      closedCardsTotal = cardModels.filter((cardModel) => cardModel.isClosed).length;
    }

    return {
      id: goalLinkModel.id,
      goalId: goalLinkModel.goalId,
      type: 'board',
      targetId: goalLinkModel.boardId,
      boardId: goalLinkModel.boardId,
      name: boardModel ? boardModel.name : goalLinkModel.boardName,
      isPersisted: !isLocalId(goalLinkModel.id),
      cardsTotal,
      closedCardsTotal,
      units: 1,
      done: cardsTotal > 0 ? closedCardsTotal / cardsTotal : 0,
    };
  }

  return null;
};

const computeProgress = (goalModel, depth = 0) => {
  if (goalModel.status === GoalStatuses.DONE) {
    return { percent: 100, isManual: false, itemsTotal: 0 };
  }

  const units = [];

  goalModel
    .getLinksQuerySet()
    .toModelArray()
    .forEach((goalLinkModel) => {
      const link = describeLink(goalLinkModel);

      if (link && !(link.type === 'board' && link.cardsTotal === 0)) {
        units.push(link.done);
      }
    });

  if (depth < MAX_DEPTH) {
    goalModel
      .getChildGoalsQuerySet()
      .toModelArray()
      .forEach((childModel) => {
        units.push(computeProgress(childModel, depth + 1).percent / 100);
      });
  }

  if (units.length === 0) {
    return {
      percent: goalModel.progress == null ? 0 : goalModel.progress,
      isManual: true,
      itemsTotal: 0,
    };
  }

  return {
    percent: Math.round((units.reduce((sum, unit) => sum + unit, 0) / units.length) * 100),
    isManual: false,
    itemsTotal: units.length,
  };
};

export const selectGoalIds = createSelector(orm, ({ Goal }) =>
  Goal.getAllQuerySet()
    .toRefArray()
    .map((goal) => goal.id),
);

export const selectGoalOptions = createSelector(orm, ({ Goal }) =>
  Goal.getAllQuerySet()
    .toRefArray()
    .map((goal) => ({ id: goal.id, name: goal.name, parentGoalId: goal.parentGoalId })),
);

// Root goals with nested children, sorted by position, plus progress.
export const selectGoalTree = createSelector(orm, ({ Goal }) => {
  const build = (goalModel, depth) => ({
    ...goalModel.ref,
    isPersisted: !isLocalId(goalModel.id),
    progress: computeProgress(goalModel),
    linksTotal: goalModel.links.count(),
    children:
      depth < MAX_DEPTH
        ? goalModel
            .getChildGoalsQuerySet()
            .toModelArray()
            .map((childModel) => build(childModel, depth + 1))
        : [],
  });

  return Goal.getAllQuerySet()
    .toModelArray()
    .filter((goalModel) => !goalModel.parentGoalId || !goalModel.parentGoal)
    .map((goalModel) => build(goalModel, 0));
});

export const makeSelectGoalById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Goal }, id) => {
      const goalModel = Goal.withId(id);

      if (!goalModel) {
        return goalModel;
      }

      return {
        ...goalModel.ref,
        isPersisted: !isLocalId(goalModel.id),
      };
    },
  );

export const selectGoalById = makeSelectGoalById();

export const makeSelectGoalProgressById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Goal }, id) => {
      const goalModel = Goal.withId(id);

      if (!goalModel) {
        return { percent: 0, isManual: true, itemsTotal: 0 };
      }

      return computeProgress(goalModel);
    },
  );

export const selectGoalProgressById = makeSelectGoalProgressById();

export const makeSelectGoalLinksByGoalId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Goal }, id) => {
      const goalModel = Goal.withId(id);

      if (!goalModel) {
        return [];
      }

      return goalModel
        .getLinksQuerySet()
        .toModelArray()
        .map(
          (goalLinkModel) =>
            describeLink(goalLinkModel) || {
              id: goalLinkModel.id,
              goalId: goalLinkModel.goalId,
              type: goalLinkModel.cardId ? 'card' : 'board',
              targetId: goalLinkModel.cardId || goalLinkModel.boardId,
              name: null,
              isPersisted: !isLocalId(goalLinkModel.id),
              isHidden: true,
            },
        );
    },
  );

export const selectGoalLinksByGoalId = makeSelectGoalLinksByGoalId();

export const selectCurrentGoal = createSelector(
  orm,
  (state) => {
    const modal = selectCurrentModal(state);
    return modal && modal.params ? modal.params.id : null;
  },
  ({ Goal }, id) => {
    if (!id) {
      return null;
    }

    const goalModel = Goal.withId(id);

    if (!goalModel) {
      return null;
    }

    return {
      ...goalModel.ref,
      isPersisted: !isLocalId(goalModel.id),
    };
  },
);

// Goals the current card is linked to (ids), for the card modal.
export const selectGoalIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ GoalLink }, cardId) => {
    if (!cardId) {
      return [];
    }

    return GoalLink.filter({ cardId })
      .toRefArray()
      .map((goalLink) => goalLink.goalId);
  },
);

export const makeSelectGoalLinkIdByGoalIdAndCardId = () =>
  createSelector(
    orm,
    (_, goalId) => goalId,
    (_, __, cardId) => cardId,
    ({ GoalLink }, goalId, cardId) => {
      const goalLinkModel = GoalLink.filter({ goalId, cardId }).first();
      return goalLinkModel ? goalLinkModel.id : null;
    },
  );

export const selectGoalLinkIdByGoalIdAndCardId = makeSelectGoalLinkIdByGoalIdAndCardId();

export const selectCanCurrentUserManageGoals = createSelector(
  orm,
  (state) => selectCurrentUserId(state),
  ({ User }, id) => {
    const userModel = id ? User.withId(id) : null;
    return !!userModel && ['admin', 'projectOwner'].includes(userModel.role);
  },
);

export default {
  selectGoalIds,
  selectGoalOptions,
  selectGoalTree,
  makeSelectGoalById,
  selectGoalById,
  makeSelectGoalProgressById,
  selectGoalProgressById,
  makeSelectGoalLinksByGoalId,
  selectGoalLinksByGoalId,
  selectCurrentGoal,
  selectGoalIdsForCurrentCard,
  makeSelectGoalLinkIdByGoalIdAndCardId,
  selectGoalLinkIdByGoalIdAndCardId,
  selectCanCurrentUserManageGoals,
};
