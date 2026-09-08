/**
 * Card tools: searching, reading, creating, editing, completing and deleting.
 *
 * "Done" in this fork is the card's `isClosed` flag. The UI sets it by dragging
 * a card into a list whose type is "closed", so complete_card does both: it
 * sets isClosed and moves the card to the board's closed list when there is
 * one. reopen_card is the mirror image.
 */

import { z } from 'zod';

import { BoardView } from '../board-view.js';
import { loadWorkspace } from '../workspace.js';
import {
  bottomPosition,
  CARD_COLORS,
  compact,
  DEFAULT_LABEL_COLOR,
  isOverdue,
  jsonResult,
  matchesDueFilter,
  parseDateInput,
  PRIORITIES,
  priorityRank,
} from '../util.js';
import { DATE_NOTE, defineTool, ID_NOTE, PEOPLE_NOTE } from './common.js';

const DUE_FILTER_HELP =
  'One of: overdue, today, this_week, next_7_days, no_date, before:<date>, after:<date>.';

/** Load a card plus the board it lives on. */
async function loadCardContext(client, cardId, { fresh = false } = {}) {
  const payload = await client.get(`/api/cards/${cardId}`);
  const card = payload.item;
  const view = new BoardView(await client.getBoard(card.boardId, { fresh }));
  return { card, payload, view };
}

/** Sort: overdue first, then soonest due, then priority, then name. */
function compareCards(a, b, now) {
  const aOverdue = isOverdue(a, now) ? 0 : 1;
  const bOverdue = isOverdue(b, now) ? 0 : 1;
  if (aOverdue !== bOverdue) {
    return aOverdue - bOverdue;
  }

  const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (aDue !== bDue) {
    return aDue - bDue;
  }

  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) {
    return byPriority;
  }

  return String(a.name).localeCompare(String(b.name));
}

/** Attach labels by name to a card, creating any that the board lacks. */
async function applyLabels(client, { boardId, cardId, labelNames, view }) {
  const applied = [];
  const byName = new Map(
    view.labels.map((label) => [(label.name || '').toLowerCase(), label]),
  );
  let nextPosition = bottomPosition(view.labels);

  for (const rawName of labelNames) {
    const name = String(rawName).trim();
    if (!name) {
      continue;
    }

    let label = byName.get(name.toLowerCase());

    if (!label) {
      const created = await client.post(`/api/boards/${boardId}/labels`, {
        name,
        color: DEFAULT_LABEL_COLOR,
        position: nextPosition,
      });
      nextPosition += 65536;
      label = created.item;
      byName.set(name.toLowerCase(), label);
      view.labels.push(label);
    }

    await client.post(`/api/cards/${cardId}/card-labels`, { labelId: label.id });
    applied.push(label.name);
  }

  return applied;
}

/** Assign board members by username. */
async function applyAssignees(client, { cardId, usernames, view }) {
  const applied = [];

  for (const rawName of usernames) {
    const username = String(rawName).trim();
    if (!username) {
      continue;
    }

    const userId = view.resolveUsername(username);

    if (!userId) {
      const known = view.members().map((member) => member.username).join(', ');
      throw new Error(
        `"${username}" is not a member of this board, so they cannot be assigned. ` +
          `Board members: ${known || '(none)'}. Add them to the board in the UI first.`,
      );
    }

    await client.post(`/api/cards/${cardId}/card-memberships`, { userId });
    applied.push(username);
  }

  return applied;
}

export function register(server, { client }) {
  defineTool(
    server,
    'find_cards',
    {
      title: 'Find cards',
      description:
        'Search cards across one board or, when boardId is omitted, every board the assistant ' +
        'can read. Filters combine with AND. Results are sorted overdue first, then by due ' +
        'date, then by priority, and each result names its project and board. ' +
        `${DATE_NOTE} ${PEOPLE_NOTE}`,
      inputSchema: {
        boardId: z
          .string()
          .optional()
          .describe('Restrict to one board. Omit to search every readable board.'),
        text: z
          .string()
          .optional()
          .describe('Case-insensitive substring matched against card name and description.'),
        status: z
          .enum(['open', 'done', 'all'])
          .optional()
          .describe('Defaults to "open". "done" means the card is closed.'),
        priority: z.enum(PRIORITIES).optional().describe('Exact priority match.'),
        assignedTo: z.string().optional().describe('Username of an assignee.'),
        label: z.string().optional().describe('Label name (case-insensitive).'),
        due: z.string().optional().describe(DUE_FILTER_HELP),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('Maximum cards to return; defaults to 50.'),
      },
    },
    async ({ boardId, text, status, priority, assignedTo, label, due, limit }) => {
      const now = new Date();
      const wantedStatus = status || 'open';
      const max = limit || 50;

      const workspace = await loadWorkspace(client);
      const boardIds = boardId ? [boardId] : workspace.allBoardIds();

      const matches = [];
      const skipped = [];

      for (const id of boardIds) {
        let view;
        try {
          view = new BoardView(await client.getBoard(id));
        } catch (error) {
          skipped.push({ boardId: id, reason: error.message });
          continue;
        }

        const boardName = view.board.name;
        const projectName =
          view.projects?.[0]?.name ?? workspace.projectNameOfBoard(id) ?? null;

        for (const card of view.cards) {
          if (wantedStatus === 'open' && card.isClosed) continue;
          if (wantedStatus === 'done' && !card.isClosed) continue;
          if (priority && card.priority !== priority) continue;

          if (text) {
            const needle = text.toLowerCase();
            const haystack = `${card.name} ${card.description || ''}`.toLowerCase();
            if (!haystack.includes(needle)) continue;
          }

          if (label) {
            const names = view.labelNames(card.id).map((name) => name.toLowerCase());
            if (!names.includes(label.trim().toLowerCase())) continue;
          }

          if (assignedTo) {
            const names = view.assignees(card.id).map((name) => name.toLowerCase());
            if (!names.includes(assignedTo.trim().toLowerCase())) continue;
          }

          if (due && !matchesDueFilter(card, due, now)) continue;

          matches.push({
            card,
            summary: view.summarizeCard(card, { now, boardName, projectName }),
          });
        }
      }

      matches.sort((a, b) => compareCards(a.card, b.card, now));

      return jsonResult(
        compact({
          total: matches.length,
          returned: Math.min(matches.length, max),
          cards: matches.slice(0, max).map((match) => match.summary),
          skippedBoards: skipped.length > 0 ? skipped : undefined,
        }),
      );
    },
  );

  defineTool(
    server,
    'get_card',
    {
      title: 'Get a card',
      description:
        'Everything about one card: description, where it lives (list, board, project), due ' +
        'date, priority, colour, labels, assignees, checklists with their items, subtask cards ' +
        'and their status, the 10 most recent comments, linked goals, recurrence rule and ' +
        `parent card. ${ID_NOTE}`,
      inputSchema: {
        cardId: z.string().describe('Card id.'),
      },
    },
    async ({ cardId }) => {
      const { card, view } = await loadCardContext(client, cardId, { fresh: true });
      const now = new Date();

      const [commentsPayload, goalsPayload] = await Promise.all([
        client.get(`/api/cards/${cardId}/comments`).catch(() => ({ items: [], included: {} })),
        client.get('/api/goals').catch(() => ({ items: [], included: {} })),
      ]);

      const commentUsers = new Map(
        (commentsPayload.included?.users || []).map((user) => [user.id, user.username]),
      );

      const comments = (commentsPayload.items || [])
        .slice()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map((comment) =>
          compact({
            id: comment.id,
            author: commentUsers.get(comment.userId) || null,
            createdAt: comment.createdAt,
            text: comment.text,
          }),
        );

      const goalsById = new Map((goalsPayload.items || []).map((goal) => [goal.id, goal]));
      const goalLinks = (goalsPayload.included?.goalLinks || [])
        .filter((link) => link.cardId === cardId)
        .map((link) =>
          compact({
            linkId: link.id,
            goalId: link.goalId,
            goalName: goalsById.get(link.goalId)?.name || null,
          }),
        );

      const parent = card.parentCardId ? view.cardById.get(card.parentCardId) : null;

      return jsonResult(
        compact({
          id: card.id,
          name: card.name,
          description: card.description,
          project: view.projects?.[0]?.name ?? null,
          board: { id: view.boardId, name: view.board.name },
          list: view.listName(card.listId),
          isDone: Boolean(card.isClosed),
          dueDate: card.dueDate,
          isOverdue: isOverdue(card, now) || undefined,
          priority: card.priority,
          color: card.color,
          labels: view.labelNames(card.id),
          assignees: view.assignees(card.id),
          checklists: view.checklists(card.id),
          subtasks: view.subtasks(card.id),
          parentCard: parent ? { id: parent.id, name: parent.name } : undefined,
          recurrenceRule: card.recurrenceRule,
          comments,
          goalLinks,
        }),
      );
    },
  );

  defineTool(
    server,
    'create_card',
    {
      title: 'Create a card',
      description:
        'Create a card at the bottom of a list. Give the list by name (listName, matched ' +
        'case-insensitively) or by id; if you give neither, the board\'s first open list is ' +
        'used. Labels are matched by name on that board and any that do not exist are created ' +
        `with a soft colour. Assignees must already be members of the board. ${DATE_NOTE} ` +
        `${PEOPLE_NOTE}`,
      inputSchema: {
        boardId: z.string().describe('Board the card belongs to.'),
        name: z.string().min(1).max(1024).describe('Card title.'),
        listName: z.string().optional().describe('Target list by name, e.g. "Backlog".'),
        listId: z.string().optional().describe('Target list by id (wins over listName).'),
        description: z.string().optional().describe('Markdown body.'),
        dueDate: z.string().optional().describe(`Due date. ${DATE_NOTE}`),
        priority: z.enum(PRIORITIES).optional().describe('low, medium, high or urgent.'),
        color: z.enum(CARD_COLORS).optional().describe('Accent colour for the card.'),
        labels: z.array(z.string()).optional().describe('Label names; missing ones are created.'),
        assignees: z.array(z.string()).optional().describe('Usernames of board members.'),
        parentCardId: z
          .string()
          .optional()
          .describe('Make this a subtask of that card. Must be on the same board.'),
        recurrenceRule: z
          .string()
          .optional()
          .describe(
            'RFC 5545 RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO". When the card is completed the ' +
              'next occurrence is created automatically.',
          ),
      },
    },
    async (args) => {
      const view = new BoardView(await client.getBoard(args.boardId, { fresh: true }));

      const list =
        view.resolveList({ listId: args.listId, listName: args.listName }) || view.firstOpenList();

      if (!list) {
        throw new Error(
          `Board ${args.boardId} has no open list to put a card in. Create one with create_list.`,
        );
      }

      const body = compact({
        type: view.board.defaultCardType || 'project',
        name: args.name,
        position: bottomPosition(view.cardsInList(list.id)),
        description: args.description || undefined,
        dueDate: args.dueDate ? parseDateInput(args.dueDate, { field: 'dueDate' }) : undefined,
        priority: args.priority || undefined,
        color: args.color || undefined,
        parentCardId: args.parentCardId || undefined,
        recurrenceRule: args.recurrenceRule || undefined,
      });

      const created = await client.post(`/api/lists/${list.id}/cards`, body);
      const card = created.item;

      const labels = args.labels?.length
        ? await applyLabels(client, {
            boardId: args.boardId,
            cardId: card.id,
            labelNames: args.labels,
            view,
          })
        : [];

      const assignees = args.assignees?.length
        ? await applyAssignees(client, { cardId: card.id, usernames: args.assignees, view })
        : [];

      client.invalidateBoard(args.boardId);

      return jsonResult({
        created: compact({
          id: card.id,
          name: card.name,
          list: list.name,
          board: view.board.name,
          dueDate: card.dueDate,
          priority: card.priority,
          color: card.color,
          labels,
          assignees,
          parentCardId: card.parentCardId,
          recurrenceRule: card.recurrenceRule,
        }),
      });
    },
  );

  defineTool(
    server,
    'update_card',
    {
      title: 'Update a card',
      description:
        'Change any subset of a card\'s fields. Pass null for dueDate, priority, color or ' +
        'recurrenceRule to clear that field. Give listName or listId to move the card to a ' +
        'different list; give boardId as well to move it to a list on another board (its ' +
        `labels and assignees do not follow it across boards). ${DATE_NOTE}`,
      inputSchema: {
        cardId: z.string().describe('Card id.'),
        name: z.string().min(1).max(1024).optional().describe('New title.'),
        description: z.string().nullable().optional().describe('New markdown body, or null.'),
        dueDate: z.string().nullable().optional().describe(`New due date, or null. ${DATE_NOTE}`),
        priority: z.enum(PRIORITIES).nullable().optional().describe('New priority, or null.'),
        color: z.enum(CARD_COLORS).nullable().optional().describe('New accent colour, or null.'),
        recurrenceRule: z
          .string()
          .nullable()
          .optional()
          .describe('New RRULE string, or null to stop it recurring.'),
        listName: z.string().optional().describe('Move to this list, by name.'),
        listId: z.string().optional().describe('Move to this list, by id.'),
        boardId: z
          .string()
          .optional()
          .describe('Move to a list on this board; pass listName or listId too.'),
      },
    },
    async (args) => {
      const { card } = await loadCardContext(client, args.cardId);

      const targetBoardId = args.boardId || card.boardId;
      const targetView = new BoardView(await client.getBoard(targetBoardId, { fresh: true }));

      const body = {};

      if (args.name !== undefined) body.name = args.name;
      if (args.description !== undefined) body.description = args.description;
      if (args.priority !== undefined) body.priority = args.priority;
      if (args.color !== undefined) body.color = args.color;
      if (args.recurrenceRule !== undefined) body.recurrenceRule = args.recurrenceRule;

      if (args.dueDate !== undefined) {
        body.dueDate =
          args.dueDate === null ? null : parseDateInput(args.dueDate, { field: 'dueDate' });
      }

      const movingBoard = args.boardId && args.boardId !== card.boardId;

      if (args.listId || args.listName || movingBoard) {
        const list =
          targetView.resolveList({ listId: args.listId, listName: args.listName }) ||
          targetView.firstOpenList();

        if (!list) {
          throw new Error(`Board ${targetBoardId} has no list to move the card into.`);
        }

        if (movingBoard) {
          body.boardId = targetBoardId;
        }
        body.listId = list.id;
        // The API wants an explicit position whenever the list changes.
        body.position = bottomPosition(targetView.cardsInList(list.id));
      }

      if (Object.keys(body).length === 0) {
        throw new Error('Nothing to update - pass at least one field.');
      }

      const updated = await client.patch(`/api/cards/${args.cardId}`, body);

      client.invalidateBoard(card.boardId);
      client.invalidateBoard(targetBoardId);

      const after = new BoardView(await client.getBoard(updated.item.boardId, { fresh: true }));

      return jsonResult({ updated: after.summarizeCard(updated.item, {
        boardName: after.board.name,
      }) });
    },
  );

  defineTool(
    server,
    'complete_card',
    {
      title: 'Complete a card',
      description:
        'Mark a card done, the way the UI does: the card is closed and moved into the board\'s ' +
        '"closed" (Done) list when it has one. If the card has a recurrence rule, completing it ' +
        'automatically creates the next occurrence.',
      inputSchema: {
        cardId: z.string().describe('Card id.'),
      },
    },
    async ({ cardId }) => {
      const { card, view } = await loadCardContext(client, cardId, { fresh: true });

      if (card.isClosed) {
        return jsonResult({ unchanged: 'Card is already done.', id: card.id, name: card.name });
      }

      const body = { isClosed: true };
      const closedList = view.closedList();

      if (closedList && card.listId !== closedList.id) {
        body.listId = closedList.id;
        body.position = bottomPosition(view.cardsInList(closedList.id));
      }

      const updated = await client.patch(`/api/cards/${cardId}`, body);
      client.invalidateBoard(card.boardId);

      const after = new BoardView(await client.getBoard(card.boardId, { fresh: true }));

      return jsonResult({
        completed: compact({
          id: updated.item.id,
          name: updated.item.name,
          list: after.listName(updated.item.listId),
          isDone: Boolean(updated.item.isClosed),
          spawnedNextOccurrence: updated.item.recurrenceRule ? true : undefined,
        }),
      });
    },
  );

  defineTool(
    server,
    'reopen_card',
    {
      title: 'Reopen a card',
      description:
        'Undo completion: the card is reopened and, if it was sitting in the board\'s "closed" ' +
        'list, moved back to the list it came from (or the first open list).',
      inputSchema: {
        cardId: z.string().describe('Card id.'),
      },
    },
    async ({ cardId }) => {
      const { card, view } = await loadCardContext(client, cardId, { fresh: true });

      if (!card.isClosed) {
        return jsonResult({ unchanged: 'Card is already open.', id: card.id, name: card.name });
      }

      const body = { isClosed: false };
      const currentList = view.listById.get(card.listId);

      if (currentList && currentList.type === 'closed') {
        const previous = card.prevListId ? view.listById.get(card.prevListId) : null;
        const target = previous && previous.type === 'active' ? previous : view.firstOpenList();

        if (target) {
          body.listId = target.id;
          body.position = bottomPosition(view.cardsInList(target.id));
        }
      }

      const updated = await client.patch(`/api/cards/${cardId}`, body);
      client.invalidateBoard(card.boardId);

      const after = new BoardView(await client.getBoard(card.boardId, { fresh: true }));

      return jsonResult({
        reopened: {
          id: updated.item.id,
          name: updated.item.name,
          list: after.listName(updated.item.listId),
          isDone: Boolean(updated.item.isClosed),
        },
      });
    },
  );

  defineTool(
    server,
    'create_subtask',
    {
      title: 'Create a subtask',
      description:
        'Create a child card under a parent card. Subtasks in this fork are ordinary cards ' +
        'with a parentCardId, so they get their own due date, priority and assignees, and they ' +
        'live on the same board and in the same list as the parent.',
      inputSchema: {
        parentCardId: z.string().describe('The parent card id.'),
        name: z.string().min(1).max(1024).describe('Subtask title.'),
        dueDate: z.string().optional().describe(`Due date. ${DATE_NOTE}`),
        priority: z.enum(PRIORITIES).optional().describe('low, medium, high or urgent.'),
        assignees: z.array(z.string()).optional().describe('Usernames of board members.'),
      },
    },
    async ({ parentCardId, name, dueDate, priority, assignees }) => {
      const { card: parent, view } = await loadCardContext(client, parentCardId, { fresh: true });

      const body = compact({
        type: view.board.defaultCardType || 'project',
        name,
        position: bottomPosition(view.cardsInList(parent.listId)),
        parentCardId,
        dueDate: dueDate ? parseDateInput(dueDate, { field: 'dueDate' }) : undefined,
        priority: priority || undefined,
      });

      const created = await client.post(`/api/lists/${parent.listId}/cards`, body);

      const applied = assignees?.length
        ? await applyAssignees(client, { cardId: created.item.id, usernames: assignees, view })
        : [];

      client.invalidateBoard(parent.boardId);

      return jsonResult({
        created: compact({
          id: created.item.id,
          name: created.item.name,
          parentCard: { id: parent.id, name: parent.name },
          list: view.listName(parent.listId),
          dueDate: created.item.dueDate,
          priority: created.item.priority,
          assignees: applied,
        }),
      });
    },
  );

  defineTool(
    server,
    'add_comment',
    {
      title: 'Comment on a card',
      description:
        'Post a comment on a card, authored by the assistant\'s own account. Comments are ' +
        'visible to everyone who can see the board.',
      inputSchema: {
        cardId: z.string().describe('Card id.'),
        text: z.string().min(1).describe('Comment body (markdown is supported).'),
      },
    },
    async ({ cardId, text }) => {
      const created = await client.post(`/api/cards/${cardId}/comments`, { text });
      return jsonResult({
        created: { id: created.item.id, cardId, text: created.item.text },
      });
    },
  );

  defineTool(
    server,
    'delete_card',
    {
      title: 'Delete a card',
      description:
        'DESTRUCTIVE AND PERMANENT: deletes a card outright, along with its comments, ' +
        'checklists and subtask links. There is no undo and it does not go to the trash list. ' +
        'Always confirm with the user, quoting the card name, before calling this. To simply ' +
        'get a card out of the way, prefer complete_card or move it to another list with ' +
        'update_card.',
      inputSchema: {
        cardId: z.string().describe('Card id to delete permanently.'),
      },
      annotations: { destructiveHint: true, idempotentHint: false, readOnlyHint: false },
    },
    async ({ cardId }) => {
      const { card } = await loadCardContext(client, cardId);
      await client.delete(`/api/cards/${cardId}`);
      client.invalidateBoard(card.boardId);

      return jsonResult({ deleted: { id: cardId, name: card.name } });
    },
  );
}
