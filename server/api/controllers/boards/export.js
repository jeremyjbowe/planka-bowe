/*!
 * planka-bowe — GET /api/boards/:id/export
 * Downloads the whole board (lists, labels, cards with the fork-specific fields,
 * card labels, task lists, tasks and custom fields) as a versioned JSON
 * document that `boards/create` can import back with
 * `importType=plankaJson`. Users, memberships, attachments and comments are
 * out of scope; `creatorUserId` is carried along for reference only.
 */

const { idInput } = require('../../../utils/inputs');

const FORMAT = 'planka-bowe-board';
const VERSION = 1;

const BOARD_FIELDS = [
  'name',
  'defaultView',
  'defaultCardType',
  'limitCardTypesToDefaultOne',
  'alwaysDisplayCardCreator',
  'displayCardAges',
  'expandTaskListsByDefault',
];

const LIST_FIELDS = ['id', 'type', 'position', 'name', 'color'];

const LABEL_FIELDS = ['id', 'position', 'name', 'color'];

const CARD_FIELDS = [
  'id',
  'listId',
  'prevListId',
  'parentCardId',
  'creatorUserId',
  'type',
  'position',
  'name',
  'description',
  'dueDate',
  'isDueCompleted',
  'isClosed',
  'stopwatch',
  'priority',
  'color',
  'recurrenceRule',
  'listChangedAt',
  'createdAt',
];

const TASK_LIST_FIELDS = [
  'id',
  'cardId',
  'position',
  'name',
  'showOnFrontOfCard',
  'hideCompletedTasks',
];

const TASK_FIELDS = ['id', 'taskListId', 'position', 'name', 'isCompleted'];

const CUSTOM_FIELD_GROUP_FIELDS = ['id', 'boardId', 'cardId', 'position', 'name'];

const CUSTOM_FIELD_FIELDS = ['id', 'customFieldGroupId', 'position', 'name', 'showOnFrontOfCard'];

const CUSTOM_FIELD_VALUE_FIELDS = ['cardId', 'customFieldGroupId', 'customFieldId', 'content'];

const Errors = {
  BOARD_NOT_FOUND: {
    boardNotFound: 'Board not found',
  },
};

module.exports = {
  inputs: {
    id: {
      ...idInput,
      required: true,
    },
  },

  exits: {
    boardNotFound: {
      responseType: 'notFound',
    },
  },

  async fn(inputs) {
    const { currentUser } = this.req;

    const { board, project } = await sails.helpers.boards
      .getPathToProjectById(inputs.id)
      .intercept('pathNotFound', () => Errors.BOARD_NOT_FOUND);

    if (currentUser.role !== User.Roles.ADMIN || project.ownerProjectManagerId) {
      const isProjectManager = await sails.helpers.users.isProjectManager(
        currentUser.id,
        project.id,
      );

      if (!isProjectManager) {
        const boardMembership = await BoardMembership.qm.getOneByBoardIdAndUserId(
          board.id,
          currentUser.id,
        );

        if (!boardMembership) {
          throw Errors.BOARD_NOT_FOUND; // Forbidden
        }
      }
    }

    const lists = await List.qm.getByBoardId(board.id);
    const labels = await Label.qm.getByBoardId(board.id);

    const cards = await Card.qm.getByBoardId(board.id);
    const cardIds = sails.helpers.utils.mapRecords(cards);

    const cardLabels = await CardLabel.qm.getByCardIds(cardIds);

    const taskLists = await TaskList.qm.getByCardIds(cardIds);
    const taskListIds = sails.helpers.utils.mapRecords(taskLists);

    const tasks = await Task.qm.getByTaskListIds(taskListIds);

    const boardCustomFieldGroups = await CustomFieldGroup.qm.getByBoardId(board.id);
    const cardCustomFieldGroups = await CustomFieldGroup.qm.getByCardIds(cardIds);

    const customFieldGroups = [...boardCustomFieldGroups, ...cardCustomFieldGroups];
    const customFieldGroupIds = sails.helpers.utils.mapRecords(customFieldGroups);

    const ownCustomFields = await CustomField.qm.getByCustomFieldGroupIds(customFieldGroupIds);

    const ownCustomFieldsByGroupId = _.groupBy(ownCustomFields, 'customFieldGroupId');

    // Groups derived from a project-level base group keep their fields on the
    // base group. The envelope must stay self-contained, so flatten those
    // fields onto the group that uses them.
    const baseCustomFieldGroupIds = sails.helpers.utils.mapRecords(
      customFieldGroups,
      'baseCustomFieldGroupId',
      true,
      true,
    );

    const baseCustomFields =
      await CustomField.qm.getByBaseCustomFieldGroupIds(baseCustomFieldGroupIds);

    const baseCustomFieldsByBaseGroupId = _.groupBy(baseCustomFields, 'baseCustomFieldGroupId');

    const customFields = customFieldGroups.flatMap((customFieldGroup) => {
      const groupCustomFields = [
        ...(ownCustomFieldsByGroupId[customFieldGroup.id] || []),
        ...(baseCustomFieldsByBaseGroupId[customFieldGroup.baseCustomFieldGroupId] || []),
      ];

      return groupCustomFields.map((customField) => ({
        ..._.pick(customField, CUSTOM_FIELD_FIELDS),
        customFieldGroupId: customFieldGroup.id,
      }));
    });

    const customFieldValues = await CustomFieldValue.qm.getByCardIds(cardIds);

    const document = {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      board: _.pick(board, BOARD_FIELDS),
      lists: lists.map((list) => _.pick(list, LIST_FIELDS)),
      labels: labels.map((label) => _.pick(label, LABEL_FIELDS)),
      cards: cards.map((card) => _.pick(card, CARD_FIELDS)),
      cardLabels: cardLabels.map((cardLabel) => _.pick(cardLabel, ['cardId', 'labelId'])),
      taskLists: taskLists.map((taskList) => _.pick(taskList, TASK_LIST_FIELDS)),
      tasks: tasks.map((task) => _.pick(task, TASK_FIELDS)),
      customFieldGroups: customFieldGroups.map((customFieldGroup) =>
        _.pick(customFieldGroup, CUSTOM_FIELD_GROUP_FIELDS),
      ),
      customFields,
      customFieldValues: customFieldValues.map((customFieldValue) =>
        _.pick(customFieldValue, CUSTOM_FIELD_VALUE_FIELDS),
      ),
    };

    const fileName = `${board.name.replace(/[^\w.-]+/g, '-').toLowerCase() || 'board'}.planka.json`;

    this.res.set('Content-Type', 'application/json; charset=utf-8');
    this.res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    this.res.set('Cache-Control', 'private, no-store');

    return this.res.send(JSON.stringify(document, null, 2));
  },
};
