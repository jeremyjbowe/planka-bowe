/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { attr, fk, many } from 'redux-orm';

import BaseModel from './BaseModel';
import filterCardModels from '../utils/filter-cards';
import { isListKanban } from '../utils/record-helpers';
import ActionTypes from '../constants/ActionTypes';
import Config from '../constants/Config';
import { BoardContexts, BoardViews } from '../constants/Enums';

// DTP fork — client-only filter state, reset every time the board is fetched
const CLEARED_FILTERS = {
  search: '',
  filterDue: null,
  filterPriorities: [],
  filterStatus: null,
  filterAssignedToMe: false,
  filterCurrentUserId: null,
};

const prepareFetchedBoard = (board) => ({
  ...board,
  isFetching: false,
  context: BoardContexts.BOARD,
  view: board.defaultView,
  ...CLEARED_FILTERS,
});

export default class extends BaseModel {
  static modelName = 'Board';

  static fields = {
    id: attr(),
    position: attr(),
    name: attr(),
    defaultView: attr(),
    defaultCardType: attr(),
    limitCardTypesToDefaultOne: attr(),
    alwaysDisplayCardCreator: attr(),
    displayCardAges: attr(),
    expandTaskListsByDefault: attr(),
    context: attr(),
    view: attr(),
    search: attr(),
    // DTP fork — richer board filters (client-only, per board)
    filterDue: attr({
      getDefault: () => null,
    }),
    filterPriorities: attr({
      getDefault: () => [],
    }),
    filterStatus: attr({
      getDefault: () => null,
    }),
    filterAssignedToMe: attr({
      getDefault: () => false,
    }),
    filterCurrentUserId: attr({
      getDefault: () => null,
    }),
    isSubscribed: attr({
      getDefault: () => false,
    }),
    isFetching: attr({
      getDefault: () => null,
    }),
    lastActivityId: attr({
      getDefault: () => null,
    }),
    isActivitiesFetching: attr({
      getDefault: () => false,
    }),
    isAllActivitiesFetched: attr({
      getDefault: () => null,
    }),
    projectId: fk({
      to: 'Project',
      as: 'project',
      relatedName: 'boards',
    }),
    memberUsers: many({
      to: 'User',
      through: 'BoardMembership',
      relatedName: 'boards',
    }),
    filterUsers: many('User', 'filterBoards'),
    filterLabels: many('Label', 'filterBoards'),
  };

  // DTP fork — saved views: apply a whole preset (or clear it) at once
  static applyFilters(boardModel, filters) {
    const nextFilters = { ...CLEARED_FILTERS };

    Object.keys(CLEARED_FILTERS).forEach((key) => {
      if (filters[key] !== undefined) {
        nextFilters[key] = filters[key];
      }
    });

    if (filters.view !== undefined) {
      nextFilters.view = filters.view;
    }

    boardModel.update(nextFilters);

    boardModel.filterUsers.clear();
    boardModel.filterLabels.clear();

    (filters.filterUserIds || []).forEach((userId) => {
      boardModel.filterUsers.add(userId);
    });

    (filters.filterLabelIds || []).forEach((labelId) => {
      boardModel.filterLabels.add(labelId);
    });
  }

  static reducer({ type, payload }, Board) {
    switch (type) {
      case ActionTypes.LOCATION_CHANGE_HANDLE:
        if (payload.board) {
          Board.upsert(prepareFetchedBoard(payload.board));
        }

        break;
      case ActionTypes.LOCATION_CHANGE_HANDLE__BOARD_FETCH:
      case ActionTypes.BOARD_FETCH:
        Board.withId(payload.id).update({
          isFetching: true,
        });

        break;
      case ActionTypes.SOCKET_RECONNECT_HANDLE: {
        const boardIds = payload.boards.map(({ id }) => id);

        Board.all()
          .toModelArray()
          .forEach((boardModel) => {
            if (boardModel.isFetching === null || !boardIds.includes(boardModel.id)) {
              boardModel.deleteWithClearable();
            }
          });

        if (payload.board) {
          const boardModel = Board.withId(payload.board.id);

          if (boardModel) {
            boardModel.update(payload.board);
          } else {
            Board.upsert(prepareFetchedBoard(payload.board));
          }
        }

        payload.boards.forEach((board) => {
          Board.upsert(board);
        });

        break;
      }
      case ActionTypes.SOCKET_RECONNECT_HANDLE__CORE_FETCH:
        Board.all()
          .toModelArray()
          .forEach((boardModel) => {
            if (boardModel.id !== payload.currentBoardId) {
              boardModel.update({
                isFetching: null,
              });

              boardModel.deleteRelated(payload.currentUserId, true);
            }
          });

        break;
      case ActionTypes.CORE_INITIALIZE:
        if (payload.board) {
          Board.upsert(prepareFetchedBoard(payload.board));
        }

        payload.boards.forEach((board) => {
          Board.upsert(board);
        });

        break;
      case ActionTypes.USER_UPDATE_HANDLE:
        Board.all()
          .toModelArray()
          .forEach((boardModel) => {
            if (!payload.boardIds.includes(boardModel.id)) {
              boardModel.deleteWithRelated(true);
            }
          });

        if (payload.board) {
          Board.upsert(prepareFetchedBoard(payload.board));
        }

        if (payload.boards) {
          payload.boards.forEach((board) => {
            Board.upsert(board);
          });
        }

        break;
      case ActionTypes.USER_TO_BOARD_FILTER_ADD: {
        const boardModel = Board.withId(payload.boardId);

        if (payload.replace) {
          boardModel.filterUsers.clear();
        }

        boardModel.filterUsers.add(payload.id);

        break;
      }
      case ActionTypes.USER_FROM_BOARD_FILTER_REMOVE:
        Board.withId(payload.boardId).filterUsers.remove(payload.id);

        break;
      case ActionTypes.PROJECT_CREATE_HANDLE:
        payload.boards.forEach((board) => {
          Board.upsert(board);
        });

        break;
      case ActionTypes.PROJECT_UPDATE_HANDLE:
      case ActionTypes.PROJECT_MANAGER_CREATE_HANDLE:
      case ActionTypes.BOARD_MEMBERSHIP_CREATE_HANDLE:
        if (payload.board) {
          Board.upsert(prepareFetchedBoard(payload.board));
        }

        if (payload.boards) {
          payload.boards.forEach((board) => {
            Board.upsert(board);
          });
        }

        break;
      case ActionTypes.BOARD_CREATE:
      case ActionTypes.BOARD_CREATE_HANDLE:
      case ActionTypes.BOARD_UPDATE__SUCCESS:
      case ActionTypes.BOARD_UPDATE_HANDLE:
        Board.upsert(payload.board);

        break;
      case ActionTypes.BOARD_CREATE__SUCCESS:
        Board.withId(payload.localId).delete();
        Board.upsert(payload.board);

        break;
      case ActionTypes.BOARD_CREATE__FAILURE:
        Board.withId(payload.localId).delete();

        break;
      case ActionTypes.BOARD_FETCH__SUCCESS:
        Board.upsert(prepareFetchedBoard(payload.board));

        break;
      case ActionTypes.BOARD_FETCH__FAILURE:
        Board.withId(payload.id).update({
          isFetching: null,
        });

        break;
      case ActionTypes.BOARD_UPDATE:
        Board.withId(payload.id).update(payload.data);

        break;
      case ActionTypes.BOARD_CONTEXT_UPDATE: {
        const boardModel = Board.withId(payload.id);

        boardModel.update({
          context: payload.value,
          view: payload.value === BoardContexts.BOARD ? boardModel.defaultView : BoardViews.LIST,
        });

        break;
      }
      case ActionTypes.IN_BOARD_SEARCH:
        Board.withId(payload.id).update({
          search: payload.value,
        });

        break;
      case ActionTypes.BOARD_DELETE:
        Board.withId(payload.id).deleteWithRelated();

        break;
      case ActionTypes.BOARD_DELETE__SUCCESS:
      case ActionTypes.BOARD_DELETE_HANDLE: {
        const boardModel = Board.withId(payload.board.id);

        if (boardModel) {
          boardModel.deleteWithRelated();
        }

        break;
      }
      case ActionTypes.LABEL_TO_BOARD_FILTER_ADD:
        Board.withId(payload.boardId).filterLabels.add(payload.id);

        break;
      case ActionTypes.LABEL_FROM_BOARD_FILTER_REMOVE:
        Board.withId(payload.boardId).filterLabels.remove(payload.id);

        break;
      // DTP fork — richer board filters
      case ActionTypes.BOARD_FILTERS_UPDATE:
        Board.withId(payload.id).update(payload.data);

        break;
      case ActionTypes.BOARD_FILTERS_CLEAR:
      case ActionTypes.SAVED_VIEW_APPLY:
        Board.applyFilters(Board.withId(payload.id), payload.data);

        break;
      case ActionTypes.ACTIVITIES_IN_BOARD_FETCH:
        Board.withId(payload.boardId).update({
          isActivitiesFetching: true,
        });

        break;
      case ActionTypes.ACTIVITIES_IN_BOARD_FETCH__SUCCESS:
        Board.withId(payload.boardId).update({
          isActivitiesFetching: false,
          isAllActivitiesFetched: payload.activities.length < Config.ACTIVITIES_LIMIT,
          ...(payload.activities.length > 0 && {
            lastActivityId: payload.activities[payload.activities.length - 1].id,
          }),
        });

        break;
      default:
    }
  }

  getMembershipsQuerySet() {
    return this.memberships.orderBy(['id.length', 'id']);
  }

  getLabelsQuerySet() {
    return this.labels.orderBy(['position', 'id.length', 'id']);
  }

  getListsQuerySet() {
    return this.lists.orderBy(['position', 'id.length', 'id']);
  }

  getKanbanListsQuerySet() {
    return this.getListsQuerySet().filter((list) => isListKanban(list));
  }

  getCustomFieldGroupsQuerySet() {
    return this.customFieldGroups.orderBy(['position', 'id.length', 'id']);
  }

  getActivitiesQuerySet() {
    return this.activities.orderBy(['id.length', 'id'], ['desc', 'desc']);
  }

  getUnreadNotificationsQuerySet() {
    return this.notifications.filter({
      isRead: false,
    });
  }

  getNotificationServicesQuerySet() {
    return this.notificationServices.orderBy(['id.length', 'id']);
  }

  getMembershipModelByUserId(userId) {
    return this.memberships
      .filter({
        userId,
      })
      .first();
  }

  getCardsModelArray() {
    return this.getKanbanListsQuerySet()
      .toModelArray()
      .flatMap((listModel) => listModel.getCardsModelArray());
  }

  getFilteredCardsModelArray() {
    return filterCardModels(this.getCardsModelArray(), this);
  }

  getActivitiesModelArray() {
    if (this.isAllActivitiesFetched === null) {
      return [];
    }

    const activityModels = this.getActivitiesQuerySet().toModelArray();

    if (this.lastActivityId && this.isAllActivitiesFetched === false) {
      return activityModels.filter((activityModel) => {
        if (activityModel.id.length > this.lastActivityId.length) {
          return true;
        }

        if (activityModel.id.length < this.lastActivityId.length) {
          return false;
        }

        return activityModel.id >= this.lastActivityId;
      });
    }

    return activityModels;
  }

  hasMembershipWithUserId(userId) {
    return this.memberships
      .filter({
        userId,
      })
      .exists();
  }

  isAvailableForUser(userModel) {
    if (!this.project) {
      return false;
    }

    return (
      this.project.isExternalAccessibleForUser(userModel) ||
      this.hasMembershipWithUserId(userModel.id)
    );
  }

  deleteListsWithRelated(soft) {
    this.lists.toModelArray().forEach((listModel) => {
      listModel.deleteWithRelated(soft);
    });
  }

  getSavedViewsQuerySet() {
    return this.savedViews.orderBy(['position', 'id.length', 'id']);
  }

  deleteClearable() {
    this.filterUsers.clear();
    this.filterLabels.clear();
  }

  deleteRelated(exceptMemberUserId, soft) {
    this.deleteClearable();

    this.memberships.toModelArray().forEach((boardMembershipModel) => {
      if (boardMembershipModel.userId !== exceptMemberUserId) {
        boardMembershipModel.deleteWithRelated();
      }
    });

    this.labels.toModelArray().forEach((labelModel) => {
      labelModel.deleteWithRelated();
    });

    this.deleteListsWithRelated(soft);
    this.notificationServices.delete();
    this.savedViews.delete();
  }

  deleteWithClearable() {
    this.deleteClearable();
    this.delete();
  }

  deleteWithRelated(soft) {
    this.deleteRelated(undefined, soft);
    this.delete();
  }
}
