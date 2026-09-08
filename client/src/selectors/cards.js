/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectRecentCardId } from './core';
import { selectPath } from './router';
import { selectCurrentUserId } from './users';
import { buildCustomFieldValueId } from '../models/CustomFieldValue';
import { isLocalId } from '../utils/local-id';

export const makeSelectCardById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return {
        ...cardModel.ref,
        isPersisted: !isLocalId(id),
      };
    },
  );

export const selectCardById = makeSelectCardById();

export const makeSelectCardIndexById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.list
        .getCardsModelArray()
        .findIndex((cardModelItem) => cardModelItem.id === cardModel.id);
    },
  );

export const selectCardIndexById = makeSelectCardIndexById();

export const makeSelectUserIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.users.toRefArray().map((user) => user.id);
    },
  );

export const selectUserIdsByCardId = makeSelectUserIdsByCardId();

export const makeSelectLabelIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.labels.toRefArray().map((label) => label.id);
    },
  );

export const selectLabelIdsByCardId = makeSelectLabelIdsByCardId();

/*
 * DTP fork — flat row objects for the Table and Timeline views.
 *
 * Takes an ordered array of card ids and returns plain objects with every
 * field those views sort or render on, resolved from the ORM in one pass.
 * Re-computes whenever the ORM changes, which is exactly what keeps the views
 * live: socket-driven updates land in the same store.
 */
export const makeSelectTableRowsByCardIds = () =>
  createSelector(
    orm,
    (_, ids) => ids,
    ({ Card }, ids) =>
      ids.flatMap((id) => {
        const cardModel = Card.withId(id);

        if (!cardModel) {
          return [];
        }

        const listModel = cardModel.list;
        const users = cardModel.users.toRefArray();
        const labels = cardModel.labels.toRefArray();
        const subtasks = cardModel.subtasks.toRefArray();
        const parentCardModel = cardModel.parentCardId ? cardModel.parentCard : null;

        return [
          {
            id,
            name: cardModel.name,
            description: cardModel.description,
            isClosed: cardModel.isClosed,
            dueDate: cardModel.dueDate,
            isDueCompleted: cardModel.isDueCompleted,
            createdAt: cardModel.createdAt,
            creatorUserId: cardModel.creatorUserId,
            listId: cardModel.listId,
            listName: listModel ? listModel.name : null,
            listPosition: listModel ? listModel.position : null,
            userIds: users.map((user) => user.id),
            userNames: users.map((user) => user.name),
            labelIds: labels.map((label) => label.id),
            labelNames: labels.map((label) => label.name || ''),
            parentCardId: cardModel.parentCardId,
            parentCardName: parentCardModel ? parentCardModel.name : null,
            subtasksTotal: subtasks.length,
            subtasksCompleted: subtasks.filter((subtask) => subtask.isClosed).length,
          },
        ];
      }),
  );

export const selectTableRowsByCardIds = makeSelectTableRowsByCardIds();

/*
 * DTP fork — subtasks. Children are ordinary cards with `parentCardId` set,
 * so these selectors are thin views over the same ORM data.
 */

const subtaskIdsOf = (cardModel) =>
  cardModel.subtasks
    .orderBy(['createdAt', 'id'])
    .toRefArray()
    .map((subtask) => subtask.id);

const subtaskProgressOf = (cardModel) => {
  const subtasks = cardModel.subtasks.toRefArray();

  return {
    total: subtasks.length,
    completed: subtasks.filter((subtask) => subtask.isClosed).length,
  };
};

const EMPTY_PROGRESS = { total: 0, completed: 0 };

export const makeSelectSubtaskIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return [];
      }

      return subtaskIdsOf(cardModel);
    },
  );

export const selectSubtaskIdsByCardId = makeSelectSubtaskIdsByCardId();

export const makeSelectSubtaskProgressByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return EMPTY_PROGRESS;
      }

      return subtaskProgressOf(cardModel);
    },
  );

export const selectSubtaskProgressByCardId = makeSelectSubtaskProgressByCardId();

export const selectSubtaskIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return [];
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return [];
    }

    return subtaskIdsOf(cardModel);
  },
);

export const selectSubtaskProgressForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return EMPTY_PROGRESS;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return EMPTY_PROGRESS;
    }

    return subtaskProgressOf(cardModel);
  },
);

export const selectParentCardForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return null;
    }

    const cardModel = Card.withId(id);

    if (!cardModel || !cardModel.parentCardId) {
      return null;
    }

    const parentCardModel = Card.withId(cardModel.parentCardId);

    return parentCardModel ? parentCardModel.ref : null;
  },
);

// Ids of the current card and everything below it; used to keep the parent
// picker from creating a cycle.
export const selectDescendantIdsWithSelfForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return [];
    }

    const result = [];
    const queue = [id];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (!result.includes(currentId)) {
        result.push(currentId);

        const cardModel = Card.withId(currentId);

        if (cardModel) {
          queue.push(...cardModel.subtasks.toRefArray().map((subtask) => subtask.id));
        }
      }
    }

    return result;
  },
);

export const selectCardsForCurrentBoard = createSelector(
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

    return boardModel.cards
      .orderBy(['name'])
      .toModelArray()
      .map((cardModel) => ({
        ...cardModel.ref,
        listName: cardModel.list ? cardModel.list.name : null,
      }));
  },
);

export const makeSelectShownOnFrontOfCardTaskListIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.getShownOnFrontOfCardTaskListsModelArray().map((taskList) => taskList.id);
    },
  );

export const selectShownOnFrontOfCardTaskListIdsByCardId =
  makeSelectShownOnFrontOfCardTaskListIdsByCardId();

export const makeSelectAttachmentsTotalByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.attachments.count();
    },
  );

export const selectAttachmentsTotalByCardId = makeSelectAttachmentsTotalByCardId();

export const makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card, CustomFieldValue }, id) => {
      if (!id) {
        return id;
      }

      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return [
        ...cardModel.board
          .getCustomFieldGroupsQuerySet()
          .toModelArray()
          .flatMap((customFieldGroupModel) =>
            customFieldGroupModel
              .getShownOnFrontOfCardCustomFieldsModelArray()
              .flatMap((customFieldModel) => {
                const customFieldValue = CustomFieldValue.withId(
                  buildCustomFieldValueId({
                    cardId: id,
                    customFieldGroupId: customFieldGroupModel.id,
                    customFieldId: customFieldModel.id,
                  }),
                );

                return customFieldValue ? customFieldValue.id : [];
              }),
          ),
        ...cardModel
          .getCustomFieldGroupsQuerySet()
          .toModelArray()
          .flatMap((customFieldGroupModel) =>
            customFieldGroupModel
              .getShownOnFrontOfCardCustomFieldsModelArray()
              .flatMap((customFieldModel) => {
                const customFieldValue = CustomFieldValue.withId(
                  buildCustomFieldValueId({
                    cardId: id,
                    customFieldGroupId: customFieldGroupModel.id,
                    customFieldId: customFieldModel.id,
                  }),
                );

                return customFieldValue ? customFieldValue.id : [];
              }),
          ),
      ];
    },
  );

export const selectShownOnFrontOfCardCustomFieldValueIdsByCardId =
  makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId();

export const makeSelectNotificationsByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.getUnreadNotificationsQuerySet().toRefArray();
    },
  );

export const selectNotificationsByCardId = makeSelectNotificationsByCardId();

export const makeSelectNotificationsTotalByCardId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Card }, id) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return cardModel;
      }

      return cardModel.getUnreadNotificationsQuerySet().count();
    },
  );

export const selectNotificationsTotalByCardId = makeSelectNotificationsTotalByCardId();

export const makeSelectIsCardWithIdRecent = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectRecentCardId(state),
    ({ Card }, id, recentCardId) => {
      const cardModel = Card.withId(id);

      if (!cardModel) {
        return false;
      }

      return cardModel.id === recentCardId;
    },
  );

export const selectIsCardWithIdRecent = makeSelectIsCardWithIdRecent();

export const selectIsCardWithIdAvailableForCurrentUser = createSelector(
  orm,
  (_, id) => id,
  (state) => selectCurrentUserId(state),
  ({ Card, User }, id, currentUserId) => {
    const cardModel = Card.withId(id);

    if (!cardModel) {
      return false;
    }

    const currentUserModel = User.withId(currentUserId);
    return cardModel.isAvailableForUser(currentUserModel);
  },
);

export const selectCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.ref;
  },
);

export const selectUserIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.users.toRefArray().map((user) => user.id);
  },
);

export const selectLabelIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.labels.toRefArray().map((label) => label.id);
  },
);

export const selectTaskListIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getTaskListsQuerySet()
      .toRefArray()
      .map((taskList) => taskList.id);
  },
);

export const selectAttachmentIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getAttachmentsQuerySet()
      .toRefArray()
      .map((attachment) => attachment.id);
  },
);

export const selectImageAttachmentIdsExceptCoverForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getAttachmentsQuerySet()
      .toModelArray()
      .filter(
        (attachmentModel) =>
          attachmentModel.data && attachmentModel.data.image && !attachmentModel.coveredCard,
      )
      .map((attachmentModel) => attachmentModel.id);
  },
);

export const selectAttachmentsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.getAttachmentsQuerySet().toRefArray();
  },
);

export const selectCustomFieldGroupIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel
      .getCustomFieldGroupsQuerySet()
      .toRefArray()
      .map((customFieldGroup) => customFieldGroup.id);
  },
);

export const selectCommentIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.getCommentsModelArray().map((commentModel) => commentModel.id);
  },
);

export const selectActivityIdsForCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  ({ Card }, id) => {
    if (!id) {
      return id;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return cardModel;
    }

    return cardModel.getActivitiesModelArray().map((activity) => activity.id);
  },
);

export const selectIsCurrentUserInCurrentCard = createSelector(
  orm,
  (state) => selectPath(state).cardId,
  (state) => selectCurrentUserId(state),
  ({ Card }, id, currentUserId) => {
    if (!id) {
      return false;
    }

    const cardModel = Card.withId(id);

    if (!cardModel) {
      return false;
    }

    return cardModel.hasUserWithId(currentUserId);
  },
);

export default {
  makeSelectCardById,
  selectCardById,
  makeSelectCardIndexById,
  selectCardIndexById,
  makeSelectUserIdsByCardId,
  selectUserIdsByCardId,
  makeSelectLabelIdsByCardId,
  selectLabelIdsByCardId,
  makeSelectTableRowsByCardIds,
  selectTableRowsByCardIds,
  makeSelectSubtaskIdsByCardId,
  selectSubtaskIdsByCardId,
  makeSelectSubtaskProgressByCardId,
  selectSubtaskProgressByCardId,
  selectSubtaskIdsForCurrentCard,
  selectSubtaskProgressForCurrentCard,
  selectParentCardForCurrentCard,
  selectDescendantIdsWithSelfForCurrentCard,
  selectCardsForCurrentBoard,
  makeSelectShownOnFrontOfCardTaskListIdsByCardId,
  selectShownOnFrontOfCardTaskListIdsByCardId,
  makeSelectAttachmentsTotalByCardId,
  makeSelectShownOnFrontOfCardCustomFieldValueIdsByCardId,
  selectShownOnFrontOfCardCustomFieldValueIdsByCardId,
  selectAttachmentsTotalByCardId,
  makeSelectNotificationsByCardId,
  selectNotificationsByCardId,
  makeSelectNotificationsTotalByCardId,
  selectNotificationsTotalByCardId,
  makeSelectIsCardWithIdRecent,
  selectIsCardWithIdRecent,
  selectIsCardWithIdAvailableForCurrentUser,
  selectCurrentCard,
  selectUserIdsForCurrentCard,
  selectLabelIdsForCurrentCard,
  selectTaskListIdsForCurrentCard,
  selectAttachmentIdsForCurrentCard,
  selectImageAttachmentIdsExceptCoverForCurrentCard,
  selectAttachmentsForCurrentCard,
  selectCustomFieldGroupIdsForCurrentCard,
  selectCommentIdsForCurrentCard,
  selectActivityIdsForCurrentCard,
  selectIsCurrentUserInCurrentCard,
};
