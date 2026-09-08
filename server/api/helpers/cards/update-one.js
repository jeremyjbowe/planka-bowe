/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    values: {
      type: 'json',
      required: true,
    },
    project: {
      type: 'ref',
      required: true,
    },
    board: {
      type: 'ref',
      required: true,
    },
    list: {
      type: 'ref',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
    webhooks: {
      type: 'ref',
    },
    request: {
      type: 'ref',
    },
  },

  exits: {
    positionMustBeInValues: {},
    boardInValuesMustBelongToProject: {},
    listMustBeInValues: {},
    listInValuesMustBelongToBoard: {},
    coverAttachmentInValuesMustContainImage: {},
  },

  // TODO: use normalizeValues and refactor
  async fn(inputs) {
    const { isSubscribed, ...values } = inputs.values;

    if (values.project && values.project.id === inputs.project.id) {
      delete values.project;
    }

    const project = values.project || inputs.project;

    if (values.board) {
      if (values.board.projectId !== project.id) {
        throw 'boardInValuesMustBelongToProject';
      }

      if (values.board.id === inputs.board.id) {
        delete values.board;
      } else {
        values.boardId = values.board.id;
      }
    }

    const board = values.board || inputs.board;

    if (values.list) {
      if (values.list.boardId !== board.id) {
        throw 'listInValuesMustBelongToBoard';
      }

      if (values.list.id === inputs.list.id) {
        delete values.list;
      } else {
        values.listId = values.list.id;
      }
    } else if (values.board) {
      throw 'listMustBeInValues';
    }

    const list = values.list || inputs.list;

    if (sails.helpers.lists.isFinite(list)) {
      if (values.list && _.isUndefined(values.position)) {
        throw 'positionMustBeInValues';
      }
    } else {
      values.position = null;
    }

    if (values.coverAttachment) {
      if (!values.coverAttachment.data.image) {
        throw 'coverAttachmentInValuesMustContainImage';
      }

      if (values.coverAttachment.id === inputs.record.coverAttachmentId) {
        delete values.coverAttachment;
      } else {
        values.coverAttachmentId = values.coverAttachment.id;
      }
    }

    // DTP fork — subtasks: `parentCard` arrives resolved from the controller
    if (!_.isUndefined(values.parentCard)) {
      const nextParentCardId = values.parentCard ? values.parentCard.id : null;

      if (nextParentCardId !== inputs.record.parentCardId) {
        values.parentCardId = nextParentCardId;
      }

      delete values.parentCard;
    }

    if (values.board) {
      // A card that changes board leaves its parent behind; its own children
      // are detached below once the move succeeded.
      values.parentCardId = null;
    }

    // DTP fork — recurring cards: a new rule starts a fresh cycle
    if (
      !_.isUndefined(values.recurrenceRule) &&
      values.recurrenceRule !== inputs.record.recurrenceRule
    ) {
      values.recurrenceSpawnedAt = null;
    }

    const dueDate = _.isUndefined(values.dueDate) ? inputs.record.dueDate : values.dueDate;

    if (dueDate) {
      const isDueCompleted = _.isUndefined(values.isDueCompleted)
        ? inputs.record.isDueCompleted
        : values.isDueCompleted;

      if (_.isNull(isDueCompleted)) {
        values.isDueCompleted = false;
      }
    } else {
      values.isDueCompleted = null;
    }

    let card;
    if (_.isEmpty(values)) {
      card = inputs.record;
    } else {
      const { webhooks = await Webhook.qm.getAll() } = inputs;

      if (!_.isNil(values.position)) {
        const cards = await Card.qm.getByListId(list.id, {
          exceptIdOrIds: inputs.record.id,
        });

        const { position, repositions } = sails.helpers.utils.insertToPositionables(
          values.position,
          cards,
        );

        values.position = position;

        if (repositions.length > 0) {
          // eslint-disable-next-line no-restricted-syntax
          for (const reposition of repositions) {
            // eslint-disable-next-line no-await-in-loop
            await Card.qm.updateOne(
              {
                id: reposition.record.id,
                listId: reposition.record.listId,
              },
              {
                position: reposition.position,
              },
            );

            sails.sockets.broadcast(`board:${board.id}`, 'cardUpdate', {
              item: {
                id: reposition.record.id,
                position: reposition.position,
              },
            });

            // TODO: send webhooks
          }
        }
      }

      let prevLabels;
      if (values.board) {
        prevLabels = await sails.helpers.cards.getLabels(inputs.record.id);

        const boardMemberUserIds = await sails.helpers.boards.getMemberUserIds(values.board.id);

        await CardSubscription.qm.delete({
          cardId: inputs.record.id,
          userId: {
            '!=': boardMemberUserIds,
          },
        });

        await CardMembership.qm.delete({
          cardId: inputs.record.id,
          userId: {
            '!=': boardMemberUserIds,
          },
        });

        await CardLabel.qm.delete({
          cardId: inputs.record.id,
        });

        const taskLists = await TaskList.qm.getByCardId(inputs.record.id);
        const taskListIds = sails.helpers.utils.mapRecords(taskLists);

        await Task.qm.update(
          {
            taskListId: taskListIds,
            assigneeUserId: {
              '!=': boardMemberUserIds,
            },
          },
          {
            assigneeUserId: null,
          },
        );

        await sails.helpers.cards.detachCustomFields(
          inputs.record.id,
          inputs.board.id,
          !!values.project,
        );
      }

      if (values.list) {
        if (values.board || inputs.list.type === List.Types.TRASH) {
          values.prevListId = null;
        } else if (sails.helpers.lists.isArchiveOrTrash(values.list)) {
          values.prevListId = inputs.list.id;
        } else if (inputs.list.type === List.Types.ARCHIVE) {
          values.prevListId = null;
        }

        const typeState = List.TYPE_STATE_BY_TYPE[values.list.type];

        if (inputs.record.isClosed) {
          if (typeState === List.TypeStates.OPENED) {
            values.isClosed = false;
          }
        } else if (typeState === List.TypeStates.CLOSED) {
          values.isClosed = true;
        }

        values.listChangedAt = new Date().toISOString();
      }

      const updateResult = await Card.qm.updateOne(inputs.record.id, values);

      ({ card } = updateResult);
      const { tasks } = updateResult;

      if (!card) {
        return card;
      }

      if (values.board) {
        await sails.helpers.cards.detachSubtasks.with({
          record: inputs.record,
          request: inputs.request,
        });

        const labels = await Label.qm.getByBoardId(card.boardId);
        const labelByName = _.keyBy(labels, 'name');

        const labelIds = await Promise.all(
          prevLabels.map(async (label) => {
            if (labelByName[label.name]) {
              return labelByName[label.name].id;
            }

            const { id } = await sails.helpers.labels.createOne.with({
              project,
              webhooks,
              values: {
                ..._.omit(label, ['id', 'boardId', 'createdAt', 'updatedAt']),
                board,
              },
              actorUser: inputs.actorUser,
            });

            return id;
          }),
        );

        await Promise.all(
          labelIds.map((labelId) => {
            try {
              return CardLabel.qm.createOne({
                labelId,
                cardId: card.id,
              });
            } catch (error) {
              if (error.code !== 'E_UNIQUE') {
                throw error;
              }
            }

            return Promise.resolve();
          }),
        );

        sails.sockets.broadcast(
          `board:${inputs.board.id}`,
          'cardUpdate',
          {
            item: {
              id: card.id,
              boardId: null,
            },
          },
          inputs.request,
        );

        sails.sockets.broadcast(
          `board:${card.boardId}`,
          'cardUpdate',
          {
            item: card,
          },
          inputs.request,
        );

        // TODO: add transfer action
      } else {
        sails.sockets.broadcast(
          `board:${card.boardId}`,
          'cardUpdate',
          {
            item: card,
          },
          inputs.request,
        );

        if (values.list) {
          await sails.helpers.actions.createOne.with({
            webhooks,
            values: {
              card,
              type: Action.Types.MOVE_CARD,
              data: {
                card: _.pick(card, ['name']),
                fromList: _.pick(inputs.list, ['id', 'type', 'name']),
                toList: _.pick(values.list, ['id', 'type', 'name']),
              },
              user: inputs.actorUser,
            },
            project: inputs.project,
            board: inputs.board,
            list: values.list,
          });
        }
      }

      if (tasks) {
        const taskListIds = sails.helpers.utils.mapRecords(tasks, 'taskListId', true);
        const taskLists = await TaskList.qm.getByIds(taskListIds);
        const taskListById = _.keyBy(taskLists, 'id');

        const cardIds = sails.helpers.utils.mapRecords(taskLists, 'cardId', true);
        const cards = await Card.qm.getByIds(cardIds);
        const cardById = _.keyBy(cards, 'id');

        const boardIdByTaskId = tasks.reduce(
          (result, task) => ({
            ...result,
            [task.id]: cardById[taskListById[task.taskListId].cardId].boardId,
          }),
          {},
        );

        tasks.forEach((task) => {
          sails.sockets.broadcast(`board:${boardIdByTaskId[task.id]}`, 'taskUpdate', {
            item: task,
          });
        });

        // TODO: send webhooks
      }

      sails.helpers.utils.sendWebhooks.with({
        webhooks,
        event: Webhook.Events.CARD_UPDATE,
        buildData: () => ({
          item: card,
          included: {
            projects: [project],
            boards: [board],
            lists: [list],
          },
        }),
        buildPrevData: () => ({
          item: inputs.record,
          included: {
            projects: [inputs.project],
            boards: [inputs.board],
            lists: [inputs.list],
          },
        }),
        user: inputs.actorUser,
      });
    }

    // DTP fork — goals: keep linked goal progress live for everyone who may see the board
    if (
      !_.isUndefined(values.isClosed) ||
      !_.isUndefined(values.name) ||
      values.board ||
      values.list
    ) {
      await sails.helpers.goalLinks.broadcastTargetUpdate.with({
        board,
        cardIds: [card.id],
      });

      if (values.board) {
        await sails.helpers.goalLinks.broadcastTargetUpdate.with({
          board: inputs.board,
        });
      }
    }

    // DTP fork — recurring cards: spawn the next occurrence as soon as this one closes.
    // The helper's atomic claim makes this safe alongside the interval job.
    if (card.isClosed && card.recurrenceRule && !card.recurrenceSpawnedAt) {
      await sails.helpers.cards.spawnNextOccurrence.with({
        record: card,
        request: inputs.request,
      });
    }

    if (!_.isUndefined(isSubscribed)) {
      const wasSubscribed = await sails.helpers.users.isCardSubscriber(
        inputs.actorUser.id,
        card.id,
      );

      if (isSubscribed !== wasSubscribed) {
        if (isSubscribed) {
          try {
            await CardSubscription.qm.createOne({
              cardId: card.id,
              userId: inputs.actorUser.id,
            });
          } catch (error) {
            if (error.code !== 'E_UNIQUE') {
              throw error;
            }
          }
        } else {
          await CardSubscription.qm.deleteOne({
            cardId: card.id,
            userId: inputs.actorUser.id,
          });
        }

        sails.sockets.broadcast(
          `user:${inputs.actorUser.id}`,
          'cardUpdate',
          {
            item: {
              isSubscribed,
              id: card.id,
            },
          },
          inputs.request,
        );

        // TODO: send webhooks
      }
    }

    return card;
  },
};
