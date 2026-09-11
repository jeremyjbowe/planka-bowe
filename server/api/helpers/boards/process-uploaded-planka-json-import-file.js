/*!
 * planka-bowe — reads and validates a board export produced by
 * `GET /api/boards/:id/export`.
 */

const fs = require('fs');
const { rimraf } = require('rimraf');

const FORMAT = 'planka-bowe-board';
const VERSION = 1;

const ARRAY_KEYS = [
  'lists',
  'labels',
  'cards',
  'cardLabels',
  'taskLists',
  'tasks',
  'customFieldGroups',
  'customFields',
  'customFieldValues',
];

module.exports = {
  inputs: {
    file: {
      type: 'json',
      required: true,
    },
  },

  exits: {
    invalidFile: {},
    unsupportedFormat: {},
  },

  async fn(inputs) {
    const content = await fs.promises.readFile(inputs.file.fd);

    let plankaBoard;
    try {
      plankaBoard = JSON.parse(content);
    } catch (error) {
      await rimraf(inputs.file.fd);
      throw 'invalidFile';
    }

    if (!_.isPlainObject(plankaBoard)) {
      await rimraf(inputs.file.fd);
      throw 'invalidFile';
    }

    if (plankaBoard.format !== FORMAT || plankaBoard.version !== VERSION) {
      await rimraf(inputs.file.fd);
      throw 'unsupportedFormat';
    }

    if (
      !_.isPlainObject(plankaBoard.board) ||
      ARRAY_KEYS.some((key) => !_.isArray(plankaBoard[key]))
    ) {
      await rimraf(inputs.file.fd);
      throw 'invalidFile';
    }

    await rimraf(inputs.file.fd);

    return plankaBoard;
  },
};
