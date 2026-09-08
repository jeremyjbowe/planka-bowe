/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import Config from '../constants/Config';
import { getAccessToken } from '../utils/access-token-storage';
import http from './http';
import socket from './socket';
import { transformCard } from './cards';
import { transformAttachment } from './attachments';

/* Actions */

const createBoard = (projectId, data, headers) =>
  socket.post(`/projects/${projectId}/boards`, data, headers);

const createBoardWithImport = (projectId, data, requestId, headers) =>
  http.post(`/projects/${projectId}/boards?requestId=${requestId}`, data, headers);

const getBoard = (id, subscribe, headers) =>
  socket
    .get(`/boards/${id}${subscribe ? '?subscribe=true' : ''}`, undefined, headers)
    .then((body) => ({
      ...body,
      included: {
        ...body.included,
        cards: body.included.cards.map(transformCard),
        attachments: body.included.attachments.map(transformAttachment),
      },
    }));

const updateBoard = (id, data, headers) => socket.patch(`/boards/${id}`, data, headers);

const deleteBoard = (id, headers) => socket.delete(`/boards/${id}`, undefined, headers);

/* DTP fork — board export as JSON
 * `http` above parses every response as JSON and drops the headers, so the
 * download goes straight through `fetch` with the bearer token from the
 * access token cookie. The Vite dev server proxies `/api` to the backend.
 */

const FILE_NAME_PATTERN = /filename="?([^";]+)"?/i;

const exportBoard = async (id, headers) => {
  const accessToken = getAccessToken();

  const response = await fetch(`${Config.BASE_PATH}/api/boards/${id}/export`, {
    method: 'GET',
    headers: {
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw await response.json().catch(() => ({ message: response.statusText }));
  }

  const match = FILE_NAME_PATTERN.exec(response.headers.get('Content-Disposition') || '');

  return {
    blob: await response.blob(),
    fileName: match ? match[1] : `board-${id}.planka.json`,
  };
};

const downloadBoardExport = async (id, headers) => {
  const { blob, fileName } = await exportBoard(id, headers);

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

export default {
  createBoard,
  createBoardWithImport,
  getBoard,
  updateBoard,
  deleteBoard,
  exportBoard,
  downloadBoardExport,
};
