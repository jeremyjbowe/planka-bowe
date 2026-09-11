/*!
 * planka-bowe — GoalLink model.
 *
 * A link to a card or a board. Besides the ids it keeps a small snapshot of
 * the target (name, completion, board totals) so progress can be computed for
 * targets whose board is not loaded in this session. Live ORM data wins when
 * it is available; `isTargetVisible` is false when the server hid the target
 * from this user.
 */

import { attr, fk } from 'redux-orm';

import BaseModel from './BaseModel';
import ActionTypes from '../constants/ActionTypes';

const applySummaries = (goalLink, { cards = [], boards = [] } = {}) => {
  const card = goalLink.cardId ? cards.find((item) => item.id === goalLink.cardId) : null;
  const board = goalLink.boardId ? boards.find((item) => item.id === goalLink.boardId) : null;

  return {
    ...goalLink,
    ...(card && {
      cardName: card.name,
      cardIsClosed: card.isClosed,
      targetBoardId: card.boardId,
    }),
    ...(board && {
      boardName: board.name,
      boardCardsTotal: board.cardsTotal,
      boardClosedCardsTotal: board.closedCardsTotal,
    }),
    ...((card || board) && { isTargetVisible: true }),
  };
};

export default class extends BaseModel {
  static modelName = 'GoalLink';

  static fields = {
    id: attr(),
    cardName: attr({
      getDefault: () => null,
    }),
    cardIsClosed: attr({
      getDefault: () => false,
    }),
    targetBoardId: attr({
      getDefault: () => null,
    }),
    boardName: attr({
      getDefault: () => null,
    }),
    boardCardsTotal: attr({
      getDefault: () => 0,
    }),
    boardClosedCardsTotal: attr({
      getDefault: () => 0,
    }),
    isTargetVisible: attr({
      getDefault: () => false,
    }),
    goalId: fk({
      to: 'Goal',
      as: 'goal',
      relatedName: 'links',
    }),
    cardId: fk({
      to: 'Card',
      as: 'card',
      relatedName: 'goalLinks',
    }),
    boardId: fk({
      to: 'Board',
      as: 'board',
      relatedName: 'goalLinks',
    }),
  };

  static reducer({ type, payload }, GoalLink) {
    switch (type) {
      case ActionTypes.SOCKET_RECONNECT_HANDLE:
        GoalLink.all().delete();

        if (payload.goalLinks) {
          payload.goalLinks.forEach((goalLink) => {
            GoalLink.upsert(
              applySummaries(goalLink, { cards: payload.goalCards, boards: payload.goalBoards }),
            );
          });
        }

        break;
      case ActionTypes.CORE_INITIALIZE:
        if (payload.goalLinks) {
          payload.goalLinks.forEach((goalLink) => {
            GoalLink.upsert(
              applySummaries(goalLink, { cards: payload.goalCards, boards: payload.goalBoards }),
            );
          });
        }

        break;
      case ActionTypes.GOAL_LINK_CREATE:
        GoalLink.upsert(payload.goalLink);

        break;
      case ActionTypes.GOAL_LINK_CREATE__SUCCESS:
        GoalLink.withId(payload.localId).delete();
        GoalLink.upsert(applySummaries(payload.goalLink, payload.included));

        break;
      case ActionTypes.GOAL_LINK_CREATE__FAILURE:
        GoalLink.withId(payload.localId).delete();

        break;
      case ActionTypes.GOAL_LINK_CREATE_HANDLE:
        GoalLink.upsert(applySummaries(payload.goalLink, payload.included));

        break;
      case ActionTypes.GOAL_LINK_UPDATE_HANDLE: {
        const goalLinkModel = GoalLink.withId(payload.goalLink.id);

        if (goalLinkModel) {
          goalLinkModel.update(applySummaries(payload.goalLink, payload.included));
        }

        break;
      }
      case ActionTypes.GOAL_LINK_DELETE:
        GoalLink.withId(payload.id).delete();

        break;
      case ActionTypes.GOAL_LINK_DELETE__SUCCESS:
      case ActionTypes.GOAL_LINK_DELETE_HANDLE: {
        const goalLinkModel = GoalLink.withId(payload.goalLink.id);

        if (goalLinkModel) {
          goalLinkModel.delete();
        }

        break;
      }
      default:
    }
  }
}
