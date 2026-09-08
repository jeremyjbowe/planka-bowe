/**
 * `overview` - a short human-readable digest of what needs attention, kept
 * deliberately small so it can be dropped straight into a reply.
 */

import { z } from 'zod';

import { BoardView } from '../board-view.js';
import { loadWorkspace } from '../workspace.js';
import {
  endOfDay,
  endOfWeek,
  isOverdue,
  priorityRank,
  startOfDay,
  textResult,
} from '../util.js';
import { defineTool, PEOPLE_NOTE } from './common.js';

const MAX_PER_SECTION = 10;
const MAX_CHARS = 4000;

function formatDue(dueDate) {
  if (!dueDate) {
    return '';
  }
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

function cardLine(entry) {
  const bits = [`  - ${entry.card.name}`];
  const meta = [];

  if (entry.card.priority) {
    meta.push(entry.card.priority);
  }
  const due = formatDue(entry.card.dueDate);
  if (due) {
    meta.push(`due ${due}`);
  }
  if (entry.assignees.length > 0) {
    meta.push(`@${entry.assignees.join(' @')}`);
  }

  if (meta.length > 0) {
    bits.push(` (${meta.join(', ')})`);
  }

  return bits.join('');
}

/** Render one bucket grouped by "project > board". */
function renderSection(title, entries) {
  if (entries.length === 0) {
    return null;
  }

  const lines = [`${title} (${entries.length})`];
  const groups = new Map();

  for (const entry of entries) {
    const key = `${entry.projectName || 'Unknown project'} > ${entry.boardName}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  }

  let shown = 0;

  for (const [group, groupEntries] of groups) {
    if (shown >= MAX_PER_SECTION) {
      break;
    }
    lines.push(` ${group}`);
    for (const entry of groupEntries) {
      if (shown >= MAX_PER_SECTION) {
        break;
      }
      lines.push(cardLine(entry));
      shown += 1;
    }
  }

  if (entries.length > shown) {
    lines.push(`  ... and ${entries.length - shown} more`);
  }

  return lines.join('\n');
}

export function register(server, { client }) {
  defineTool(
    server,
    'overview',
    {
      title: 'Workload overview',
      description:
        'A short digest of everything that needs attention across every readable board: ' +
        'overdue cards, cards due today, the rest of this week, and open urgent/high priority ' +
        'work, each grouped by project and board, followed by goals with their progress. ' +
        `Pass assignedTo to narrow it to one person's cards. ${PEOPLE_NOTE}`,
      inputSchema: {
        assignedTo: z
          .string()
          .optional()
          .describe('Username; defaults to everyone\'s cards.'),
      },
    },
    async ({ assignedTo }) => {
      const now = new Date();
      const todayEnd = endOfDay(now);
      const todayStart = startOfDay(now);
      const weekEnd = endOfWeek(now);

      const workspace = await loadWorkspace(client);

      const overdue = [];
      const today = [];
      const thisWeek = [];
      const hot = [];

      for (const boardId of workspace.allBoardIds()) {
        let view;
        try {
          view = new BoardView(await client.getBoard(boardId));
        } catch {
          continue; // A board we cannot read is simply left out.
        }

        const boardName = view.board.name;
        const projectName =
          view.projects?.[0]?.name ?? workspace.projectNameOfBoard(boardId) ?? null;

        for (const card of view.cards) {
          if (card.isClosed) {
            continue;
          }

          const assignees = view.assignees(card.id);

          if (assignedTo) {
            const wanted = assignedTo.trim().toLowerCase();
            if (!assignees.some((name) => name.toLowerCase() === wanted)) {
              continue;
            }
          }

          const entry = { card, assignees, boardName, projectName };
          const due = card.dueDate ? new Date(card.dueDate) : null;
          const hasDue = due && !Number.isNaN(due.getTime());

          if (isOverdue(card, now)) {
            overdue.push(entry);
          } else if (hasDue && due >= todayStart && due <= todayEnd) {
            today.push(entry);
          } else if (hasDue && due > todayEnd && due <= weekEnd) {
            thisWeek.push(entry);
          } else if (card.priority === 'urgent' || card.priority === 'high') {
            // Only surface hot work that is not already listed above.
            hot.push(entry);
          }
        }
      }

      const byUrgency = (a, b) => {
        const aDue = a.card.dueDate ? new Date(a.card.dueDate).getTime() : Infinity;
        const bDue = b.card.dueDate ? new Date(b.card.dueDate).getTime() : Infinity;
        if (aDue !== bDue) return aDue - bDue;
        return priorityRank(a.card.priority) - priorityRank(b.card.priority);
      };

      [overdue, today, thisWeek].forEach((bucket) => bucket.sort(byUrgency));
      hot.sort((a, b) => priorityRank(a.card.priority) - priorityRank(b.card.priority));

      const sections = [
        renderSection('OVERDUE', overdue),
        renderSection('DUE TODAY', today),
        renderSection('DUE THIS WEEK', thisWeek),
        renderSection('URGENT / HIGH (no near due date)', hot),
      ].filter(Boolean);

      // Goals, with the same progress rules the UI uses.
      let goalLines = [];
      try {
        const goalsPayload = await client.get('/api/goals');
        const goals = goalsPayload.items || [];
        const links = goalsPayload.included?.goalLinks || [];
        const cardById = new Map(
          (goalsPayload.included?.cards || []).map((card) => [card.id, card]),
        );
        const boardById = new Map(
          (goalsPayload.included?.boards || []).map((board) => [board.id, board]),
        );

        const linksByGoal = new Map();
        for (const link of links) {
          if (!linksByGoal.has(link.goalId)) linksByGoal.set(link.goalId, []);
          linksByGoal.get(link.goalId).push(link);
        }

        const percentOf = (goal) => {
          if (goal.status === 'done') return 100;
          const units = [];
          for (const link of linksByGoal.get(goal.id) || []) {
            if (link.cardId) {
              const card = cardById.get(link.cardId);
              if (card) units.push(card.isClosed ? 1 : 0);
            } else if (link.boardId) {
              const board = boardById.get(link.boardId);
              if (board && (board.cardsTotal ?? 0) > 0) {
                units.push(board.closedCardsTotal / board.cardsTotal);
              }
            }
          }
          for (const child of goals.filter((candidate) => candidate.parentGoalId === goal.id)) {
            units.push(percentOf(child) / 100);
          }
          if (units.length === 0) return goal.progress == null ? 0 : goal.progress;
          return Math.round((units.reduce((sum, unit) => sum + unit, 0) / units.length) * 100);
        };

        goalLines = goals
          .filter((goal) => goal.status !== 'done')
          .slice(0, MAX_PER_SECTION)
          .map((goal) => `  - ${goal.name}: ${percentOf(goal)}% (${goal.status})`);
      } catch {
        goalLines = ['  (goals unavailable)'];
      }

      if (goalLines.length > 0) {
        sections.push(['GOALS', ...goalLines].join('\n'));
      }

      const header = assignedTo ? `Overview for @${assignedTo}` : 'Overview (everyone)';
      let text = [header, '', ...sections].join('\n\n').trimEnd();

      if (sections.length === 0) {
        text = `${header}\n\nNothing overdue, due this week, or flagged urgent.`;
      }

      if (text.length > MAX_CHARS) {
        text = `${text.slice(0, MAX_CHARS)}\n... (truncated)`;
      }

      return textResult(text);
    },
  );
}
