/**
 * Checklist tools. A card holds task lists ("checklists"), each holding tasks
 * ("items"). Toggling an item is a PATCH on the task itself, so the tool takes
 * a taskId rather than a card + text pair.
 */

import { z } from 'zod';

import { bottomPosition, jsonResult } from '../util.js';
import { defineTool } from './common.js';

export function register(server, { client }) {
  defineTool(
    server,
    'add_checklist_item',
    {
      title: 'Add a checklist item',
      description:
        'Append an item to a checklist on a card. If checklistName is given it is matched ' +
        'case-insensitively and created when missing; otherwise the card\'s first checklist is ' +
        'used, and a checklist called "Checklist" is created if the card has none. Use ' +
        'get_card to read back the item ids you need for toggle_checklist_item.',
      inputSchema: {
        cardId: z.string().describe('Card id.'),
        text: z.string().min(1).max(1024).describe('The item text.'),
        checklistName: z
          .string()
          .optional()
          .describe('Which checklist to add to; defaults to the first one on the card.'),
      },
    },
    async ({ cardId, text, checklistName }) => {
      const cardPayload = await client.get(`/api/cards/${cardId}`);
      const card = cardPayload.item;

      const existing = (cardPayload.included?.taskLists || [])
        .slice()
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      let taskList = null;

      if (checklistName) {
        const wanted = checklistName.trim().toLowerCase();
        taskList = existing.find((list) => (list.name || '').toLowerCase() === wanted) || null;
      } else {
        taskList = existing[0] || null;
      }

      if (!taskList) {
        const created = await client.post(`/api/cards/${cardId}/task-lists`, {
          name: checklistName || 'Checklist',
          position: bottomPosition(existing),
        });
        taskList = created.item;
      }

      const siblings = (cardPayload.included?.tasks || []).filter(
        (task) => task.taskListId === taskList.id,
      );

      const created = await client.post(`/api/task-lists/${taskList.id}/tasks`, {
        name: text,
        position: bottomPosition(siblings),
      });

      client.invalidateBoard(card.boardId);

      return jsonResult({
        created: {
          taskId: created.item.id,
          text: created.item.name,
          checklist: taskList.name,
          isCompleted: Boolean(created.item.isCompleted),
        },
      });
    },
  );

  defineTool(
    server,
    'toggle_checklist_item',
    {
      title: 'Tick or untick a checklist item',
      description:
        'Set a checklist item to done or not done. taskId comes from get_card (checklists[].' +
        'items[].taskId) or from add_checklist_item.',
      inputSchema: {
        taskId: z.string().describe('The checklist item id.'),
        isCompleted: z.boolean().describe('true to tick it, false to untick it.'),
      },
    },
    async ({ taskId, isCompleted }) => {
      const updated = await client.patch(`/api/tasks/${taskId}`, { isCompleted });

      // The task payload does not name its board, so clear the whole cache.
      client.invalidateBoard();

      return jsonResult({
        updated: {
          taskId: updated.item.id,
          text: updated.item.name,
          isCompleted: Boolean(updated.item.isCompleted),
        },
      });
    },
  );
}
