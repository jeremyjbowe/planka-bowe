/*!
 * planka-bowe — saved views.
 *
 * Shared views go to everybody in the board room; personal ones only to the
 * sockets of the user who owns them, so a private preset never leaks. When
 * a view's `isShared` flips, the previous visibility has to be told about it
 * too (`prevRecord`), otherwise stale copies linger in other tabs.
 */

module.exports = {
  sync: true,

  inputs: {
    record: {
      type: 'ref',
      required: true,
    },
    event: {
      type: 'string',
      required: true,
    },
    prevRecord: {
      type: 'ref',
    },
    request: {
      type: 'ref',
    },
  },

  fn(inputs) {
    const { record, event, prevRecord } = inputs;

    const rooms = new Set();

    if (record.isShared) {
      rooms.add(`board:${record.boardId}`);
    } else if (record.creatorUserId) {
      rooms.add(`@user:${record.creatorUserId}`);
    }

    if (prevRecord && prevRecord.isShared && !record.isShared) {
      rooms.add(`board:${record.boardId}`);
    }

    rooms.forEach((room) => {
      sails.sockets.broadcast(
        room,
        event,
        {
          item: record,
        },
        inputs.request,
      );
    });
  },
};
