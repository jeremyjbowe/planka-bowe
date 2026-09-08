/*!
 * DTP fork — recurring cards.
 *
 * Creates the next occurrence of a completed recurring card: same name,
 * description, type, labels, members, checklists (unchecked) and recurrence
 * rule, placed at the top of the board's first active list with the next due
 * date computed by the RRULE from the previous due date.
 *
 * Idempotency: the card is claimed with a single conditional UPDATE that sets
 * `recurrence_spawned_at`. If zero rows come back, another trigger already
 * spawned it (or it is not eligible) and we return null without side effects.
 */

const { RRule } = require('rrule');

const POSITION_GAP = 65536;

const computeNextDueDate = (recurrenceRule, previousDueDate) => {
  const base = previousDueDate ? new Date(previousDueDate) : new Date();

  const rrule = new RRule({
    ...RRule.parseString(recurrenceRule),
    dtstart: base,
  });

  return rrule.after(base, false);
};

module.exports = {
  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    request: {
      type: 'ref',
    },
  },

  async fn(inputs) {
    const claimResult = await sails.sendNativeQuery(
      'UPDATE card SET recurrence_spawned_at = NOW(), updated_at = NOW() WHERE id = $1 AND recurrence_rule IS NOT NULL AND is_closed AND recurrence_spawned_at IS NULL RETURNING id',
      [inputs.record.id],
    );

    if (claimResult.rows.length === 0) {
      return null;
    }

    const record = await Card.qm.getOneById(inputs.record.id);

    if (!record) {
      return null;
    }

    sails.sockets.broadcast(`board:${record.boardId}`, 'cardUpdate', {
      item: {
        id: record.id,
        recurrenceSpawnedAt: record.recurrenceSpawnedAt,
      },
    });

    let nextDueDate;
    try {
      nextDueDate = computeNextDueDate(record.recurrenceRule, record.dueDate);
    } catch (error) {
      sails.log.warn(`Recurrence: invalid rule on card ${record.id}: ${record.recurrenceRule}`);
      return null;
    }

    if (!nextDueDate) {
      // The rule has run its course (COUNT/UNTIL reached).
      return null;
    }

    const lists = await List.qm.getByBoardId(record.boardId, {
      typeOrTypes: List.Types.ACTIVE,
    });

    const list = lists[0] || (await List.qm.getOneById(record.listId));

    if (!list) {
      return null;
    }

    const cardsInList = await Card.qm.getByListId(list.id);
    const position = cardsInList.length > 0 ? cardsInList[0].position / 2 : POSITION_GAP;

    const card = await Card.qm.createOne({
      ..._.pick(record, ['type', 'name', 'description', 'creatorUserId', 'recurrenceRule']),
      boardId: record.boardId,
      listId: list.id,
      position,
      dueDate: nextDueDate.toISOString(),
      isDueCompleted: false,
      isClosed: false,
      listChangedAt: new Date().toISOString(),
    });

    const boardMemberUserIds = await sails.helpers.boards.getMemberUserIds(card.boardId);
    const boardMemberUserIdsSet = new Set(boardMemberUserIds);

    const cardMemberships = await CardMembership.qm.getByCardId(record.id, {
      userIdOrIds: boardMemberUserIds,
    });

    await CardMembership.qm.create(
      cardMemberships.map((cardMembership) => ({
        userId: cardMembership.userId,
        cardId: card.id,
      })),
    );

    const cardLabels = await CardLabel.qm.getByCardId(record.id);

    await CardLabel.qm.create(
      cardLabels.map((cardLabel) => ({
        labelId: cardLabel.labelId,
        cardId: card.id,
      })),
    );

    const taskLists = await TaskList.qm.getByCardId(record.id);
    const taskListIds = sails.helpers.utils.mapRecords(taskLists);
    const tasks = await Task.qm.getByTaskListIds(taskListIds);
    const ids = await sails.helpers.utils.generateIds(taskLists.length);

    const nextTaskListIdByTaskListId = {};

    await TaskList.qm.create(
      taskLists.map((taskList) => {
        const id = ids.shift();
        nextTaskListIdByTaskListId[taskList.id] = id;

        return {
          ..._.pick(taskList, ['position', 'name', 'showOnFrontOfCard', 'hideCompletedTasks']),
          id,
          cardId: card.id,
        };
      }),
    );

    await Task.qm.create(
      tasks.map((task) => ({
        ..._.pick(task, ['position', 'name']),
        isCompleted: false,
        taskListId: nextTaskListIdByTaskListId[task.taskListId],
        assigneeUserId: boardMemberUserIdsSet.has(task.assigneeUserId) ? task.assigneeUserId : null,
      })),
    );

    sails.sockets.broadcast(`board:${card.boardId}`, 'cardCreate', {
      item: card,
    });

    sails.log.info(
      `Recurrence: spawned card ${card.id} from ${record.id} (${record.recurrenceRule}), due ${card.dueDate}`,
    );

    return card;
  },
};
