/*!
 * DTP fork — saved views API.
 */

import socket from './socket';

/* Actions */

const createSavedView = (boardId, data, headers) =>
  socket.post(`/boards/${boardId}/saved-views`, data, headers);

const updateSavedView = (id, data, headers) => socket.patch(`/saved-views/${id}`, data, headers);

const deleteSavedView = (id, headers) => socket.delete(`/saved-views/${id}`, undefined, headers);

export default {
  createSavedView,
  updateSavedView,
  deleteSavedView,
};
