/*!
 * DTP fork — recreates a board from an envelope produced by
 * `GET /api/boards/:id/export`.
 *
 * Lists, labels, cards (with the DTP fields and remapped parent links), card
 * labels, task lists, tasks and custom field groups/fields/values are
 * recreated with fresh ids; positions are kept as exported. Memberships,
 * attachments and comments are out of scope, and every imported card is
 * credited to the importing user.
 */

module.exports = {
  inputs: {
    board: {
      type: 'ref',
      required: true,
    },
    lists: {
      type: 'ref',
      required: true,
    },
    plankaBoard: {
      type: 'json',
      required: true,
    },
    actorUser: {
      type: 'ref',
      required: true,
    },
  },

  async fn(inputs) {
    const { board, plankaBoard, actorUser } = inputs;

    // `Board.qm.createOne` already made the archive and trash lists, so the
    // exported ones are mapped onto them instead of being recreated.
    const listIdByExportedListId = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedList of plankaBoard.lists) {
      const existingList = inputs.lists.find((list) => list.type === exportedList.type);

      if (existingList) {
        listIdByExportedListId[exportedList.id] = existingList.id;
        // eslint-disable-next-line no-continue
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const list = await List.qm.createOne({
        boardId: board.id,
        type: exportedList.type,
        position: exportedList.position,
        name: exportedList.name || null,
        color: exportedList.color || null,
      });

      listIdByExportedListId[exportedList.id] = list.id;
    }

    const fallbackListId =
      listIdByExportedListId[
        (plankaBoard.lists.find((list) => list.type === List.Types.ACTIVE) || {}).id
      ] || inputs.lists.find((list) => list.type === List.Types.ARCHIVE).id;

    const labelIdByExportedLabelId = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedLabel of plankaBoard.labels) {
      // eslint-disable-next-line no-await-in-loop
      const label = await Label.qm.createOne({
        boardId: board.id,
        position: exportedLabel.position,
        name: exportedLabel.name || null,
        color: Label.COLORS.includes(exportedLabel.color) ? exportedLabel.color : Label.COLORS[0],
      });

      labelIdByExportedLabelId[exportedLabel.id] = label.id;
    }

    const now = new Date().toISOString();
    const cardIdByExportedCardId = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedCard of plankaBoard.cards) {
      const values = {
        boardId: board.id,
        listId: listIdByExportedListId[exportedCard.listId] || fallbackListId,
        prevListId: listIdByExportedListId[exportedCard.prevListId] || null,
        creatorUserId: actorUser.id,
        type: Object.values(Card.Types).includes(exportedCard.type)
          ? exportedCard.type
          : Card.Types.PROJECT,
        position: exportedCard.position,
        name: exportedCard.name,
        description: exportedCard.description || null,
        dueDate: exportedCard.dueDate || null,
        isDueCompleted: _.isNil(exportedCard.isDueCompleted) ? null : exportedCard.isDueCompleted,
        isClosed: exportedCard.isClosed === true,
        stopwatch: exportedCard.stopwatch || null,
        priority: Object.values(Card.Priorities).includes(exportedCard.priority)
          ? exportedCard.priority
          : null,
        color: Object.values(Card.Colors).includes(exportedCard.color) ? exportedCard.color : null,
        recurrenceRule: exportedCard.recurrenceRule || null,
        listChangedAt: exportedCard.listChangedAt || now,
      };

      // An already-closed recurring card must not spawn a successor just
      // because it was imported.
      if (values.recurrenceRule && values.isClosed) {
        values.recurrenceSpawnedAt = now;
      }

      // eslint-disable-next-line no-await-in-loop
      const card = await Card.qm.createOne(values);
      cardIdByExportedCardId[exportedCard.id] = card.id;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedCard of plankaBoard.cards) {
      const cardId = cardIdByExportedCardId[exportedCard.id];
      const parentCardId = cardIdByExportedCardId[exportedCard.parentCardId];

      if (cardId && parentCardId && cardId !== parentCardId) {
        // eslint-disable-next-line no-await-in-loop
        await Card.qm.updateOne(cardId, { parentCardId });
      }
    }

    const cardLabelValues = plankaBoard.cardLabels
      .map((exportedCardLabel) => ({
        cardId: cardIdByExportedCardId[exportedCardLabel.cardId],
        labelId: labelIdByExportedLabelId[exportedCardLabel.labelId],
      }))
      .filter(({ cardId, labelId }) => cardId && labelId);

    if (cardLabelValues.length > 0) {
      await CardLabel.qm.create(cardLabelValues);
    }

    const taskListIdByExportedTaskListId = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedTaskList of plankaBoard.taskLists) {
      const cardId = cardIdByExportedCardId[exportedTaskList.cardId];

      if (cardId) {
        // eslint-disable-next-line no-await-in-loop
        const taskList = await TaskList.qm.createOne({
          cardId,
          position: exportedTaskList.position,
          name: exportedTaskList.name,
          showOnFrontOfCard: exportedTaskList.showOnFrontOfCard !== false,
          hideCompletedTasks: exportedTaskList.hideCompletedTasks === true,
        });

        taskListIdByExportedTaskListId[exportedTaskList.id] = taskList.id;
      }
    }

    const taskValues = plankaBoard.tasks
      .map((exportedTask) => ({
        taskListId: taskListIdByExportedTaskListId[exportedTask.taskListId],
        position: exportedTask.position,
        name: exportedTask.name,
        isCompleted: exportedTask.isCompleted === true,
      }))
      .filter(({ taskListId }) => taskListId);

    if (taskValues.length > 0) {
      await Task.qm.create(taskValues);
    }

    const customFieldGroupIdByExportedCustomFieldGroupId = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedCustomFieldGroup of plankaBoard.customFieldGroups) {
      const values = {
        position: exportedCustomFieldGroup.position,
        name: exportedCustomFieldGroup.name || null,
      };

      if (exportedCustomFieldGroup.cardId) {
        values.cardId = cardIdByExportedCardId[exportedCustomFieldGroup.cardId];
      } else {
        values.boardId = board.id;
      }

      if (values.boardId || values.cardId) {
        // eslint-disable-next-line no-await-in-loop
        const customFieldGroup = await CustomFieldGroup.qm.createOne(values);
        customFieldGroupIdByExportedCustomFieldGroupId[exportedCustomFieldGroup.id] =
          customFieldGroup.id;
      }
    }

    // Fields are flattened onto their group in the envelope, so a field is
    // identified by the pair (exported group id, exported field id).
    const customFieldIdByExportedKey = {};

    // eslint-disable-next-line no-restricted-syntax
    for (const exportedCustomField of plankaBoard.customFields) {
      const customFieldGroupId =
        customFieldGroupIdByExportedCustomFieldGroupId[exportedCustomField.customFieldGroupId];

      if (customFieldGroupId) {
        // eslint-disable-next-line no-await-in-loop
        const customField = await CustomField.qm.createOne({
          customFieldGroupId,
          position: exportedCustomField.position,
          name: exportedCustomField.name,
          showOnFrontOfCard: exportedCustomField.showOnFrontOfCard === true,
        });

        const key = `${exportedCustomField.customFieldGroupId}:${exportedCustomField.id}`;
        customFieldIdByExportedKey[key] = customField.id;
      }
    }

    const customFieldValueValues = plankaBoard.customFieldValues
      .map((exportedCustomFieldValue) => ({
        cardId: cardIdByExportedCardId[exportedCustomFieldValue.cardId],
        customFieldGroupId:
          customFieldGroupIdByExportedCustomFieldGroupId[
            exportedCustomFieldValue.customFieldGroupId
          ],
        customFieldId:
          customFieldIdByExportedKey[
            `${exportedCustomFieldValue.customFieldGroupId}:${exportedCustomFieldValue.customFieldId}`
          ],
        content: exportedCustomFieldValue.content,
      }))
      .filter(({ cardId, customFieldGroupId, customFieldId }) =>
        Boolean(cardId && customFieldGroupId && customFieldId),
      );

    if (customFieldValueValues.length > 0) {
      await CustomFieldValue.qm.create(customFieldValueValues);
    }
  },
};
