/*!
 * planka-bowe — saved view selectors.
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectPath } from './router';
import { selectCurrentUserId } from './users';
import { isLocalId } from '../utils/local-id';

// A preset and the board's live filter state are the same view when every
// dimension matches; arrays are compared as sets.
const normalizeFilters = (data = {}) => ({
  view: data.view || null,
  search: data.search || '',
  filterUserIds: [...(data.filterUserIds || [])].sort().join(','),
  filterLabelIds: [...(data.filterLabelIds || [])].sort().join(','),
  filterDue: data.filterDue || null,
  filterPriorities: [...(data.filterPriorities || [])].sort().join(','),
  filterStatus: data.filterStatus || null,
  filterAssignedToMe: !!data.filterAssignedToMe,
});

export const areFiltersEqual = (data, otherData) => {
  const left = normalizeFilters(data);
  const right = normalizeFilters(otherData);

  return Object.keys(left).every((key) => left[key] === right[key]);
};

const buildSavedView = (savedViewModel, currentUserId) => ({
  ...savedViewModel.ref,
  isPersisted: !isLocalId(savedViewModel.id),
  isOwn: savedViewModel.creatorUserId === currentUserId,
});

export const makeSelectSavedViewById = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectCurrentUserId(state),
    ({ SavedView }, id, currentUserId) => {
      const savedViewModel = SavedView.withId(id);

      if (!savedViewModel) {
        return savedViewModel;
      }

      return buildSavedView(savedViewModel, currentUserId);
    },
  );

export const selectSavedViewById = makeSelectSavedViewById();

export const selectSavedViewsForCurrentBoard = createSelector(
  orm,
  (state) => selectPath(state).boardId,
  (state) => selectCurrentUserId(state),
  ({ Board }, id, currentUserId) => {
    if (!id) {
      return [];
    }

    const boardModel = Board.withId(id);

    if (!boardModel) {
      return [];
    }

    const savedViews = boardModel
      .getSavedViewsQuerySet()
      .toModelArray()
      .map((savedViewModel) => buildSavedView(savedViewModel, currentUserId));

    // Shared presets first, then the personal ones.
    return [
      ...savedViews.filter((savedView) => savedView.isShared),
      ...savedViews.filter((savedView) => !savedView.isShared),
    ];
  },
);

export const selectSavedViewIdsForCurrentBoard = createSelector(
  orm,
  (state) => selectPath(state).boardId,
  ({ Board }, id) => {
    if (!id) {
      return [];
    }

    const boardModel = Board.withId(id);

    if (!boardModel) {
      return [];
    }

    return boardModel
      .getSavedViewsQuerySet()
      .toRefArray()
      .map((savedView) => savedView.id);
  },
);

export const selectActiveSavedViewIdForCurrentBoard = createSelector(
  orm,
  (state) => selectPath(state).boardId,
  ({ Board }, id) => {
    if (!id) {
      return null;
    }

    const boardModel = Board.withId(id);

    if (!boardModel) {
      return null;
    }

    const current = {
      view: boardModel.view,
      search: boardModel.search || '',
      filterUserIds: boardModel.filterUsers.toRefArray().map((user) => user.id),
      filterLabelIds: boardModel.filterLabels.toRefArray().map((label) => label.id),
      filterDue: boardModel.filterDue || null,
      filterPriorities: boardModel.filterPriorities || [],
      filterStatus: boardModel.filterStatus || null,
      filterAssignedToMe: !!boardModel.filterAssignedToMe,
    };

    const match = boardModel
      .getSavedViewsQuerySet()
      .toRefArray()
      .find((savedView) => areFiltersEqual(savedView.data, current));

    return match ? match.id : null;
  },
);

export default {
  makeSelectSavedViewById,
  selectSavedViewById,
  selectSavedViewsForCurrentBoard,
  selectSavedViewIdsForCurrentBoard,
  selectActiveSavedViewIdForCurrentBoard,
};
