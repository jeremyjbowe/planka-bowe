/*!
 * planka-bowe — SavedView model.
 *
 * A named preset of a board's view mode and filter state. `data` holds
 * `{ view, search, filterUserIds, filterLabelIds, filterDue,
 *    filterPriorities, filterStatus, filterAssignedToMe }`.
 */

import { attr, fk } from 'redux-orm';

import BaseModel from './BaseModel';
import ActionTypes from '../constants/ActionTypes';

export default class extends BaseModel {
  static modelName = 'SavedView';

  static fields = {
    id: attr(),
    name: attr(),
    isShared: attr({
      getDefault: () => false,
    }),
    data: attr({
      getDefault: () => ({}),
    }),
    position: attr(),
    createdAt: attr({
      getDefault: () => new Date(),
    }),
    boardId: fk({
      to: 'Board',
      as: 'board',
      relatedName: 'savedViews',
    }),
    creatorUserId: fk({
      to: 'User',
      as: 'creatorUser',
      relatedName: 'createdSavedViews',
    }),
  };

  static reducer({ type, payload }, SavedView) {
    switch (type) {
      case ActionTypes.LOCATION_CHANGE_HANDLE:
      case ActionTypes.CORE_INITIALIZE:
      case ActionTypes.SOCKET_RECONNECT_HANDLE:
        if (payload.savedViews) {
          payload.savedViews.forEach((savedView) => {
            SavedView.upsert(savedView);
          });
        }

        break;
      case ActionTypes.BOARD_FETCH__SUCCESS:
        if (payload.savedViews) {
          payload.savedViews.forEach((savedView) => {
            SavedView.upsert(savedView);
          });
        }

        break;
      case ActionTypes.SAVED_VIEW_CREATE:
      case ActionTypes.SAVED_VIEW_CREATE_HANDLE:
      case ActionTypes.SAVED_VIEW_UPDATE__SUCCESS:
      case ActionTypes.SAVED_VIEW_UPDATE_HANDLE:
        SavedView.upsert(payload.savedView);

        break;
      case ActionTypes.SAVED_VIEW_CREATE__SUCCESS: {
        const savedViewModel = SavedView.withId(payload.localId);

        if (savedViewModel) {
          savedViewModel.delete();
        }

        SavedView.upsert(payload.savedView);

        break;
      }
      case ActionTypes.SAVED_VIEW_CREATE__FAILURE: {
        const savedViewModel = SavedView.withId(payload.localId);

        if (savedViewModel) {
          savedViewModel.delete();
        }

        break;
      }
      case ActionTypes.SAVED_VIEW_UPDATE:
        SavedView.withId(payload.id).update(payload.data);

        break;
      case ActionTypes.SAVED_VIEW_DELETE: {
        const savedViewModel = SavedView.withId(payload.id);

        if (savedViewModel) {
          savedViewModel.delete();
        }

        break;
      }
      case ActionTypes.SAVED_VIEW_DELETE__SUCCESS:
      case ActionTypes.SAVED_VIEW_DELETE_HANDLE: {
        const savedViewModel = SavedView.withId(payload.savedView.id);

        if (savedViewModel) {
          savedViewModel.delete();
        }

        break;
      }
      default:
    }
  }
}
