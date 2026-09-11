/*!
 * planka-bowe — calendar feeds. Absolute URLs for a token.
 */

module.exports = {
  sync: true,

  inputs: {
    token: {
      type: 'string',
      required: true,
    },
    boardId: {
      type: 'string',
    },
  },

  fn(inputs) {
    const { baseUrl } = sails.config.custom;
    const base = inputs.boardId
      ? `${baseUrl}/feeds/${inputs.token}/boards/${inputs.boardId}/todos.ics`
      : `${baseUrl}/feeds/${inputs.token}/todos.ics`;

    return {
      todosUrl: base,
      eventsUrl: `${base}?mode=events`,
    };
  },
};
