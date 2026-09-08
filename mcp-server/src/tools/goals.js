/**
 * Goal (OKR) tools.
 *
 * Progress mirrors `client/src/selectors/goals.js#computeProgress` exactly:
 *   - a goal marked "done" is 100%
 *   - otherwise every link and every child goal contributes one unit:
 *       * a card link contributes 1 when the card is closed, else 0
 *       * a board link contributes closedCards / totalCards, and is ignored
 *         entirely when the board has no cards
 *       * a child goal contributes its own computed percentage
 *     and the goal's percentage is the mean of those units
 *   - a goal with no links and no children falls back to its manually set
 *     `progress` value (0 when unset)
 */

import { z } from 'zod';

import { resolveUserId, usernameById } from '../workspace.js';
import { compact, jsonResult, parseDateInput } from '../util.js';
import { DATE_NOTE, defineTool } from './common.js';

const MAX_DEPTH = 8;
const STATUSES = ['active', 'paused', 'done'];

/** Index a `GET /api/goals` payload for progress computation. */
function indexGoals(payload) {
  const goals = payload.items || [];
  const included = payload.included || {};

  const cardById = new Map((included.cards || []).map((card) => [card.id, card]));
  const boardById = new Map((included.boards || []).map((board) => [board.id, board]));

  const linksByGoalId = new Map();
  for (const link of included.goalLinks || []) {
    if (!linksByGoalId.has(link.goalId)) {
      linksByGoalId.set(link.goalId, []);
    }
    linksByGoalId.get(link.goalId).push(link);
  }

  const childrenByParentId = new Map();
  for (const goal of goals) {
    const parent = goal.parentGoalId || null;
    if (!childrenByParentId.has(parent)) {
      childrenByParentId.set(parent, []);
    }
    childrenByParentId.get(parent).push(goal);
  }

  return {
    goals,
    goalById: new Map(goals.map((goal) => [goal.id, goal])),
    cardById,
    boardById,
    linksByGoalId,
    childrenByParentId,
    users: included.users || [],
  };
}

/** Describe one link, or null when its target is not visible to us. */
function describeLink(link, index) {
  if (link.cardId) {
    const card = index.cardById.get(link.cardId);
    if (!card) {
      return null;
    }
    return {
      linkId: link.id,
      type: 'card',
      targetId: card.id,
      name: card.name,
      isClosed: Boolean(card.isClosed),
      done: card.isClosed ? 1 : 0,
    };
  }

  if (link.boardId) {
    const board = index.boardById.get(link.boardId);
    if (!board) {
      return null;
    }
    const cardsTotal = board.cardsTotal ?? 0;
    const closedCardsTotal = board.closedCardsTotal ?? 0;
    return {
      linkId: link.id,
      type: 'board',
      targetId: board.id,
      name: board.name,
      cardsTotal,
      closedCardsTotal,
      done: cardsTotal > 0 ? closedCardsTotal / cardsTotal : 0,
    };
  }

  return null;
}

function computeProgress(goal, index, depth = 0) {
  if (goal.status === 'done') {
    return { percent: 100, isManual: false, itemsTotal: 0 };
  }

  const units = [];

  for (const link of index.linksByGoalId.get(goal.id) || []) {
    const described = describeLink(link, index);
    if (described && !(described.type === 'board' && described.cardsTotal === 0)) {
      units.push(described.done);
    }
  }

  if (depth < MAX_DEPTH) {
    for (const child of index.childrenByParentId.get(goal.id) || []) {
      units.push(computeProgress(child, index, depth + 1).percent / 100);
    }
  }

  if (units.length === 0) {
    return {
      percent: goal.progress == null ? 0 : goal.progress,
      isManual: true,
      itemsTotal: 0,
    };
  }

  const mean = units.reduce((sum, unit) => sum + unit, 0) / units.length;
  return { percent: Math.round(mean * 100), isManual: false, itemsTotal: units.length };
}

export function register(server, { client }) {
  const fetchIndex = async () => indexGoals(await client.get('/api/goals'));

  defineTool(
    server,
    'list_goals',
    {
      title: 'List goals',
      description:
        'List goals (OKRs) as a tree, each with its computed progress percentage. Progress is ' +
        'the mean of its linked cards (done or not), linked boards (share of closed cards) and ' +
        'child goals; a goal with nothing linked shows its manually set percentage instead, ' +
        'flagged as manual.',
      inputSchema: {
        status: z
          .enum([...STATUSES, 'all'])
          .optional()
          .describe('Filter top-level goals by status. Defaults to all.'),
      },
    },
    async ({ status }) => {
      const index = await fetchIndex();

      const build = (goal, depth) =>
        compact({
          id: goal.id,
          name: goal.name,
          status: goal.status,
          targetDate: goal.targetDate,
          progress: computeProgress(goal, index, depth).percent,
          isManualProgress: computeProgress(goal, index, depth).isManual || undefined,
          linksTotal: (index.linksByGoalId.get(goal.id) || []).length || undefined,
          children:
            depth < MAX_DEPTH
              ? (index.childrenByParentId.get(goal.id) || []).map((child) =>
                  build(child, depth + 1),
                )
              : [],
        });

      const roots = index.goals.filter(
        (goal) => !goal.parentGoalId || !index.goalById.has(goal.parentGoalId),
      );

      const filtered =
        !status || status === 'all' ? roots : roots.filter((goal) => goal.status === status);

      return jsonResult({ goals: filtered.map((goal) => build(goal, 0)) });
    },
  );

  defineTool(
    server,
    'get_goal',
    {
      title: 'Get a goal',
      description:
        'One goal in full: status, target date, owner username, computed progress, every link ' +
        '(each linked card with whether it is done, each linked board with its closed/total ' +
        'card counts) and its child goals with their own progress.',
      inputSchema: {
        goalId: z.string().describe('Goal id, from list_goals.'),
      },
    },
    async ({ goalId }) => {
      const index = await fetchIndex();
      const goal = index.goalById.get(goalId);

      if (!goal) {
        throw new Error(`No goal with id ${goalId}. Use list_goals to see what exists.`);
      }

      const progress = computeProgress(goal, index, 0);

      const links = (index.linksByGoalId.get(goal.id) || [])
        .map((link) => describeLink(link, index))
        .filter(Boolean);

      const children = (index.childrenByParentId.get(goal.id) || []).map((child) =>
        compact({
          id: child.id,
          name: child.name,
          status: child.status,
          progress: computeProgress(child, index, 1).percent,
        }),
      );

      return jsonResult(
        compact({
          id: goal.id,
          name: goal.name,
          description: goal.description,
          status: goal.status,
          targetDate: goal.targetDate,
          owner: goal.ownerUserId ? await usernameById(client, goal.ownerUserId) : null,
          parentGoalId: goal.parentGoalId,
          progress: progress.percent,
          isManualProgress: progress.isManual || undefined,
          links,
          children,
        }),
      );
    },
  );

  defineTool(
    server,
    'create_goal',
    {
      title: 'Create a goal',
      description:
        'Create a goal. Link it to cards or boards afterwards with link_goal_to_card / ' +
        'link_goal_to_board so its progress is computed automatically; set progress here only ' +
        `for a goal you intend to track by hand. ${DATE_NOTE}`,
      inputSchema: {
        name: z.string().min(1).max(256).describe('Goal name.'),
        description: z.string().max(4096).optional().describe('Optional detail.'),
        status: z
          .enum(STATUSES)
          .optional()
          .describe('active (default), paused, or done. A "done" goal always reads 100%.'),
        targetDate: z.string().optional().describe(`Target date. ${DATE_NOTE}`),
        parentGoalId: z.string().optional().describe('Nest this goal under another goal.'),
        progress: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Manual percentage; ignored once the goal has links or children.'),
      },
    },
    async (args) => {
      const created = await client.post(
        '/api/goals',
        compact({
          name: args.name,
          description: args.description || undefined,
          status: args.status || 'active',
          targetDate: args.targetDate
            ? parseDateInput(args.targetDate, { field: 'targetDate' })
            : undefined,
          parentGoalId: args.parentGoalId || undefined,
          progress: args.progress ?? undefined,
        }),
      );

      return jsonResult({
        created: compact({
          id: created.item.id,
          name: created.item.name,
          status: created.item.status,
          targetDate: created.item.targetDate,
          parentGoalId: created.item.parentGoalId,
        }),
      });
    },
  );

  defineTool(
    server,
    'update_goal',
    {
      title: 'Update a goal',
      description:
        'Change a goal\'s name, description, status, target date, parent or manual progress. ' +
        'Pass null to clear description, targetDate, parentGoalId or progress. Setting status ' +
        'to "done" makes it report 100% regardless of its links.',
      inputSchema: {
        goalId: z.string().describe('Goal id.'),
        name: z.string().min(1).max(256).optional().describe('New name.'),
        description: z.string().max(4096).nullable().optional().describe('New detail, or null.'),
        status: z.enum(STATUSES).optional().describe('active, paused or done.'),
        targetDate: z.string().nullable().optional().describe(`New target date, or null.`),
        parentGoalId: z.string().nullable().optional().describe('New parent goal, or null.'),
        progress: z
          .number()
          .min(0)
          .max(100)
          .nullable()
          .optional()
          .describe('Manual percentage, or null to clear it.'),
        owner: z.string().optional().describe('Username of the new owner.'),
      },
    },
    async (args) => {
      const body = {};

      if (args.name !== undefined) body.name = args.name;
      if (args.description !== undefined) body.description = args.description;
      if (args.status !== undefined) body.status = args.status;
      if (args.parentGoalId !== undefined) body.parentGoalId = args.parentGoalId;
      if (args.progress !== undefined) body.progress = args.progress;

      if (args.targetDate !== undefined) {
        body.targetDate =
          args.targetDate === null
            ? null
            : parseDateInput(args.targetDate, { field: 'targetDate' });
      }

      if (args.owner !== undefined) {
        body.ownerUserId = await resolveUserId(client, args.owner);
      }

      if (Object.keys(body).length === 0) {
        throw new Error('Nothing to update - pass at least one field.');
      }

      const updated = await client.patch(`/api/goals/${args.goalId}`, body);

      return jsonResult({
        updated: compact({
          id: updated.item.id,
          name: updated.item.name,
          status: updated.item.status,
          targetDate: updated.item.targetDate,
          progress: updated.item.progress,
        }),
      });
    },
  );

  defineTool(
    server,
    'link_goal_to_card',
    {
      title: 'Link a goal to a card',
      description:
        'Attach a card to a goal. The card then counts as one unit of that goal\'s progress: ' +
        'complete for a done card, incomplete otherwise.',
      inputSchema: {
        goalId: z.string().describe('Goal id.'),
        cardId: z.string().describe('Card id.'),
      },
    },
    async ({ goalId, cardId }) => {
      const created = await client.post(`/api/goals/${goalId}/goal-links`, { cardId });
      return jsonResult({
        linked: { linkId: created.item.id, goalId, cardId, type: 'card' },
      });
    },
  );

  defineTool(
    server,
    'link_goal_to_board',
    {
      title: 'Link a goal to a board',
      description:
        'Attach a whole board to a goal. The board contributes its share of closed cards to ' +
        'the goal\'s progress; an empty board is ignored rather than counted as 0%.',
      inputSchema: {
        goalId: z.string().describe('Goal id.'),
        boardId: z.string().describe('Board id.'),
      },
    },
    async ({ goalId, boardId }) => {
      const created = await client.post(`/api/goals/${goalId}/goal-links`, { boardId });
      return jsonResult({
        linked: { linkId: created.item.id, goalId, boardId, type: 'board' },
      });
    },
  );

  defineTool(
    server,
    'unlink_goal',
    {
      title: 'Remove a goal link',
      description:
        'Detach a card or board from a goal. Give the linkId from get_goal, or give goalId ' +
        'together with the cardId or boardId to look it up. This removes only the link; the ' +
        'card or board itself is untouched.',
      inputSchema: {
        linkId: z.string().optional().describe('Link id, from get_goal links[].linkId.'),
        goalId: z.string().optional().describe('Goal id, when resolving by target.'),
        cardId: z.string().optional().describe('Linked card id, with goalId.'),
        boardId: z.string().optional().describe('Linked board id, with goalId.'),
      },
    },
    async ({ linkId, goalId, cardId, boardId }) => {
      let targetLinkId = linkId;

      if (!targetLinkId) {
        if (!goalId || (!cardId && !boardId)) {
          throw new Error('Pass linkId, or goalId plus either cardId or boardId.');
        }

        const index = await fetchIndex();
        const match = (index.linksByGoalId.get(goalId) || []).find((link) =>
          cardId ? link.cardId === cardId : link.boardId === boardId,
        );

        if (!match) {
          throw new Error(
            `Goal ${goalId} is not linked to that ${cardId ? 'card' : 'board'}.`,
          );
        }

        targetLinkId = match.id;
      }

      await client.delete(`/api/goal-links/${targetLinkId}`);
      return jsonResult({ unlinked: { linkId: targetLinkId } });
    },
  );
}
