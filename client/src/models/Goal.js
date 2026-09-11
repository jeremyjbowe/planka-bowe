/*!
 * planka-bowe — Goal model. Global objective, optionally nested, linked to
 * cards and boards through GoalLink.
 */

import { attr, fk } from 'redux-orm';

import BaseModel from './BaseModel';
import ActionTypes from '../constants/ActionTypes';

export default class extends BaseModel {
  static modelName = 'Goal';

  static fields = {
    id: attr(),
    name: attr(),
    description: attr(),
    status: attr(),
    targetDate: attr(),
    progress: attr(),
    position: attr(),
    createdAt: attr({
      getDefault: () => new Date(),
    }),
    ownerUserId: fk({
      to: 'User',
      as: 'owner',
      relatedName: 'ownedGoals',
    }),
    parentGoalId: fk({
      to: 'Goal',
      as: 'parentGoal',
      relatedName: 'childGoals',
    }),
  };

  static reducer({ type, payload }, Goal) {
    switch (type) {
      case ActionTypes.SOCKET_RECONNECT_HANDLE:
        Goal.all().delete();

        if (payload.goals) {
          payload.goals.forEach((goal) => {
            Goal.upsert(goal);
          });
        }

        break;
      case ActionTypes.CORE_INITIALIZE:
        if (payload.goals) {
          payload.goals.forEach((goal) => {
            Goal.upsert(goal);
          });
        }

        break;
      case ActionTypes.GOAL_CREATE:
      case ActionTypes.GOAL_CREATE_HANDLE:
      case ActionTypes.GOAL_UPDATE__SUCCESS:
      case ActionTypes.GOAL_UPDATE_HANDLE:
        Goal.upsert(payload.goal);

        break;
      case ActionTypes.GOAL_CREATE__SUCCESS:
        Goal.withId(payload.localId).delete();
        Goal.upsert(payload.goal);

        break;
      case ActionTypes.GOAL_CREATE__FAILURE:
        Goal.withId(payload.localId).delete();

        break;
      case ActionTypes.GOAL_UPDATE:
        Goal.withId(payload.id).update(payload.data);

        break;
      case ActionTypes.GOAL_DELETE: {
        const goalModel = Goal.withId(payload.id);

        if (goalModel) {
          goalModel.deleteWithRelated();
        }

        break;
      }
      case ActionTypes.GOAL_DELETE__SUCCESS:
      case ActionTypes.GOAL_DELETE_HANDLE: {
        const goalModel = Goal.withId(payload.goal.id);

        if (goalModel) {
          goalModel.deleteWithRelated();
        }

        break;
      }
      default:
    }
  }

  static getAllQuerySet() {
    return this.orderBy(['position', 'id.length', 'id']);
  }

  getChildGoalsQuerySet() {
    return this.childGoals.orderBy(['position', 'id.length', 'id']);
  }

  getLinksQuerySet() {
    return this.links.orderBy(['id.length', 'id']);
  }

  deleteWithRelated() {
    this.childGoals.update({
      parentGoalId: null,
    });

    this.links.delete();
    this.delete();
  }
}
