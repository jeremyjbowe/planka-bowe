/**
 * Structural tools: the project/board tree and the creation of projects,
 * boards, lists and labels.
 */

import { z } from 'zod';

import { BoardView } from '../board-view.js';
import { loadWorkspace } from '../workspace.js';
import { bottomPosition, jsonResult, LABEL_COLORS, POSITION_STEP } from '../util.js';
import { defineTool, ID_NOTE } from './common.js';

export function register(server, { client }) {
  defineTool(
    server,
    'list_projects',
    {
      title: 'List projects and boards',
      description:
        'Return the whole project tree the assistant can see, with each project\'s boards. ' +
        'Projects can nest (a project may have a parent), so the result is nested: each node ' +
        'has id, name, boards[{id,name}] and children[]. Start here when you do not yet know ' +
        `a board id. ${ID_NOTE}`,
      inputSchema: {},
    },
    async () => {
      const workspace = await loadWorkspace(client);
      return jsonResult({ projects: workspace.tree() });
    },
  );

  defineTool(
    server,
    'get_board',
    {
      title: 'Get a board',
      description:
        'Full picture of one board: its lists (id, name, type - "active" means open, ' +
        '"closed" means the done column), labels, members, and a summary of every card. ' +
        'Each card carries id, name, list, dueDate, priority, color, labels, assignees, ' +
        'isDone, parentCardId, subtask progress and whether it recurs. ' +
        `Use list_projects first if you need the board id. ${ID_NOTE}`,
      inputSchema: {
        boardId: z.string().describe('Board id, from list_projects.'),
      },
    },
    async ({ boardId }) => {
      const view = new BoardView(await client.getBoard(boardId, { fresh: true }));
      const now = new Date();

      return jsonResult({
        board: { id: view.boardId, name: view.board.name, projectId: view.projectId },
        lists: view.lists
          .filter((list) => list.name || list.type === 'active' || list.type === 'closed')
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((list) => ({ id: list.id, name: list.name, type: list.type })),
        labels: view.labels.map((label) => ({
          id: label.id,
          name: label.name,
          color: label.color,
        })),
        members: view.members(),
        cards: view.cards
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((card) => view.summarizeCard(card, { now })),
      });
    },
  );

  defineTool(
    server,
    'create_project',
    {
      title: 'Create a project',
      description:
        'Create a new project. It is created as a shared project so every admin (including ' +
        'this assistant) keeps access, and the assistant becomes one of its managers. ' +
        'Pass parentProjectId to nest it under an existing project.',
      inputSchema: {
        name: z.string().min(1).max(128).describe('Project name.'),
        parentProjectId: z
          .string()
          .optional()
          .describe('Optional parent project id, to nest this project beneath it.'),
        description: z.string().max(1024).optional().describe('Optional description.'),
      },
    },
    async ({ name, parentProjectId, description }) => {
      const created = await client.post('/api/projects', {
        type: 'shared',
        name,
        ...(description ? { description } : {}),
      });

      let project = created.item;

      if (parentProjectId) {
        const updated = await client.patch(`/api/projects/${project.id}`, { parentProjectId });
        project = updated.item;
      }

      return jsonResult({
        created: {
          id: project.id,
          name: project.name,
          parentProjectId: project.parentProjectId ?? null,
        },
      });
    },
  );

  defineTool(
    server,
    'create_board',
    {
      title: 'Create a board',
      description:
        'Create a board inside a project. A brand new board has no lists - add them with ' +
        'create_list (at least one "active" list, and usually one "closed" list to act as Done).',
      inputSchema: {
        projectId: z.string().describe('Project id, from list_projects.'),
        name: z.string().min(1).max(128).describe('Board name.'),
      },
    },
    async ({ projectId, name }) => {
      const workspace = await loadWorkspace(client);
      const siblings = workspace.boards.filter((board) => board.projectId === projectId);

      const created = await client.post(`/api/projects/${projectId}/boards`, {
        name,
        position: bottomPosition(siblings),
      });

      return jsonResult({
        created: { id: created.item.id, name: created.item.name, projectId },
      });
    },
  );

  defineTool(
    server,
    'create_list',
    {
      title: 'Create a list',
      description:
        'Add a list (a column) to a board, at the far right. type "active" is a normal open ' +
        'column; type "closed" is a Done column - moving a card into a "closed" list marks it ' +
        'done, and completing a card moves it there. A board should have exactly one "closed" list.',
      inputSchema: {
        boardId: z.string().describe('Board id.'),
        name: z.string().min(1).max(128).describe('List name, e.g. "In Progress".'),
        type: z
          .enum(['active', 'closed'])
          .optional()
          .describe('Defaults to "active". Use "closed" for the Done column.'),
      },
    },
    async ({ boardId, name, type }) => {
      const view = new BoardView(await client.getBoard(boardId, { fresh: true }));

      const created = await client.post(`/api/boards/${boardId}/lists`, {
        name,
        type: type || 'active',
        position: bottomPosition(view.lists.filter((list) => typeof list.position === 'number')),
      });

      client.invalidateBoard(boardId);

      return jsonResult({
        created: { id: created.item.id, name: created.item.name, type: created.item.type },
      });
    },
  );

  defineTool(
    server,
    'create_label',
    {
      title: 'Create a label',
      description:
        'Create a label on a board. Labels are per board, so the same name on two boards is ' +
        `two labels. Valid colors: ${LABEL_COLORS.join(', ')}.`,
      inputSchema: {
        boardId: z.string().describe('Board id.'),
        name: z.string().min(1).max(128).describe('Label name.'),
        color: z
          .enum(LABEL_COLORS)
          .optional()
          .describe('Palette colour; defaults to a soft blue-grey.'),
      },
    },
    async ({ boardId, name, color }) => {
      const view = new BoardView(await client.getBoard(boardId, { fresh: true }));

      const created = await client.post(`/api/boards/${boardId}/labels`, {
        name,
        color: color || 'morning-sky',
        position: bottomPosition(view.labels) || POSITION_STEP,
      });

      client.invalidateBoard(boardId);

      return jsonResult({
        created: { id: created.item.id, name: created.item.name, color: created.item.color },
      });
    },
  );
}
