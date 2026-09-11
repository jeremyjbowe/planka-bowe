#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Spawns the MCP server over stdio with the real SDK client, exercises the
 * whole card lifecycle against the live Planka Bowe instance, and deletes
 * everything it created before it exits - including on failure.
 *
 * Configuration comes from the same place the server uses: PLANKA_BOWE_MCP_ENV
 * or ~/.config/planka-bowe-mcp/.env. Set SMOKE_BOARD_ID to pin a board;
 * otherwise the first board returned by list_projects is used.
 *
 *   node test/smoke.mjs
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, '..', 'src', 'index.js');

const CARD_NAME = 'MCP smoke test';
const SUBTASK_NAME = 'MCP smoke test subtask';

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail ? ` - ${detail}` : ''}`);
    console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ''}`);
  }
}

/** Call a tool and parse its JSON text payload. */
async function callJson(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content || []).map((part) => part.text || '').join('\n');

  if (result.isError) {
    throw new Error(`${name} returned an error: ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { _text: text };
  }
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: process.env,
    stderr: 'inherit',
  });

  const client = new Client({ name: 'planka-bowe-smoke', version: '1.0.0' });
  await client.connect(transport);

  const createdCardIds = [];

  try {
    console.log('\n1. tools/list');
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    console.log(`  ${tools.length} tools: ${names.join(', ')}`);

    const expected = [
      'add_checklist_item',
      'add_comment',
      'complete_card',
      'create_board',
      'create_card',
      'create_goal',
      'create_label',
      'create_list',
      'create_project',
      'create_subtask',
      'delete_card',
      'find_cards',
      'get_board',
      'get_card',
      'get_goal',
      'link_goal_to_board',
      'link_goal_to_card',
      'list_goals',
      'list_projects',
      'overview',
      'reopen_card',
      'toggle_checklist_item',
      'unlink_goal',
      'update_card',
      'update_goal',
    ];
    const missing = expected.filter((name) => !names.includes(name));
    check('all expected tools are registered', missing.length === 0, missing.join(', '));
    check(
      'every tool has a description',
      tools.every((tool) => (tool.description || '').length > 20),
    );

    console.log('\n2. list_projects');
    const projects = await callJson(client, 'list_projects');
    check('returns a project tree', Array.isArray(projects.projects) && projects.projects.length > 0);

    const boards = [];
    const walk = (nodes) => {
      for (const node of nodes || []) {
        for (const board of node.boards || []) {
          boards.push({ ...board, project: node.name });
        }
        walk(node.children);
      }
    };
    walk(projects.projects);
    check('at least one board is visible', boards.length > 0);

    const boardId = process.env.SMOKE_BOARD_ID || boards[0]?.id;
    if (!boardId) {
      throw new Error('No board available to test against.');
    }
    console.log(`  using board ${boardId}`);

    console.log('\n3. get_board');
    const board = await callJson(client, 'get_board', { boardId });
    check('board has lists', Array.isArray(board.lists) && board.lists.length > 0);
    check('board reports its cards', Array.isArray(board.cards));
    const activeLists = board.lists.filter((list) => list.type === 'active');
    const closedList = board.lists.find((list) => list.type === 'closed');
    check('board has an open list', activeLists.length > 0);
    console.log(
      `  lists: ${board.lists.map((list) => `${list.name || list.type}:${list.type}`).join(', ')}`,
    );

    console.log('\n4. create_card');
    const created = await callJson(client, 'create_card', {
      boardId,
      name: CARD_NAME,
      listName: activeLists[0].name,
      description: 'Created by the planka-bowe-mcp smoke test. Safe to delete.',
      dueDate: '2026-09-15',
      priority: 'high',
      color: 'sky',
    });
    const cardId = created.created?.id;
    check('card created with an id', Boolean(cardId));
    if (cardId) createdCardIds.push(cardId);
    check('card landed on the requested list', created.created?.list === activeLists[0].name);
    check('priority round-tripped', created.created?.priority === 'high');
    check('due date became ISO 8601', /^\d{4}-\d{2}-\d{2}T/.test(created.created?.dueDate || ''));

    console.log('\n5. update_card');
    const updated = await callJson(client, 'update_card', {
      cardId,
      name: CARD_NAME,
      description: 'Updated by the smoke test.',
      priority: 'urgent',
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
    });
    check('priority updated', updated.updated?.priority === 'urgent');
    check('recurrence recorded', updated.updated?.hasRecurrence === true);

    if (activeLists.length > 1) {
      const moved = await callJson(client, 'update_card', {
        cardId,
        listName: activeLists[1].name,
      });
      check('card moved between lists', moved.updated?.list === activeLists[1].name);
    }

    // Clear the rule again so completing the card does not spawn a follow-up
    // occurrence that this test would then have to clean up.
    const cleared = await callJson(client, 'update_card', { cardId, recurrenceRule: null });
    check('recurrence cleared', !cleared.updated?.hasRecurrence);

    console.log('\n6. add_comment');
    const comment = await callJson(client, 'add_comment', {
      cardId,
      text: 'Smoke test comment.',
    });
    check('comment created', Boolean(comment.created?.id));

    console.log('\n7. create_subtask');
    const subtask = await callJson(client, 'create_subtask', {
      parentCardId: cardId,
      name: SUBTASK_NAME,
      priority: 'low',
    });
    const subtaskId = subtask.created?.id;
    check('subtask created', Boolean(subtaskId));
    if (subtaskId) createdCardIds.push(subtaskId);
    check('subtask points at its parent', subtask.created?.parentCard?.id === cardId);

    console.log('\n8. add_checklist_item + toggle_checklist_item');
    const item = await callJson(client, 'add_checklist_item', {
      cardId,
      text: 'Smoke test checklist item',
    });
    const taskId = item.created?.taskId;
    check('checklist item created', Boolean(taskId));
    if (taskId) {
      const toggled = await callJson(client, 'toggle_checklist_item', {
        taskId,
        isCompleted: true,
      });
      check('checklist item ticked', toggled.updated?.isCompleted === true);
    }

    console.log('\n9. complete_card');
    const completed = await callJson(client, 'complete_card', { cardId });
    check('card reports done', completed.completed?.isDone === true);
    if (closedList) {
      check('card moved to the closed list', completed.completed?.list === closedList.name);
    }

    console.log('\n10. find_cards (status=done)');
    const done = await callJson(client, 'find_cards', {
      boardId,
      status: 'done',
      text: CARD_NAME,
    });
    const foundDone = (done.cards || []).some((card) => card.id === cardId);
    check('completed card is findable as done', foundDone);

    const open = await callJson(client, 'find_cards', {
      boardId,
      status: 'open',
      text: CARD_NAME,
    });
    check(
      'completed card no longer shows as open',
      !(open.cards || []).some((card) => card.id === cardId),
    );

    console.log('\n11. get_card');
    const detail = await callJson(client, 'get_card', { cardId });
    check('name matches', detail.name === CARD_NAME);
    check('isDone is true', detail.isDone === true);
    check('description present', typeof detail.description === 'string');
    check('comment visible', (detail.comments || []).some((c) => c.text === 'Smoke test comment.'));
    check('subtask visible', (detail.subtasks || []).some((s) => s.id === subtaskId));
    check(
      'checklist visible',
      (detail.checklists || []).some((list) =>
        (list.items || []).some((entry) => entry.taskId === taskId),
      ),
    );

    console.log('\n12. reopen_card');
    const reopened = await callJson(client, 'reopen_card', { cardId });
    check('card reopened', reopened.reopened?.isDone === false);

    console.log('\n13. overview');
    const overviewResult = await client.callTool({ name: 'overview', arguments: {} });
    const overviewText = (overviewResult.content || []).map((part) => part.text).join('');
    check('overview produced text', overviewText.length > 0);
    check('overview stays under 4 KB', overviewText.length <= 4100, `${overviewText.length} chars`);

    console.log('\n14. list_goals');
    const goals = await callJson(client, 'list_goals');
    check('goals listed', Array.isArray(goals.goals));
  } finally {
    console.log('\n15. cleanup (delete_card)');
    // Children first, so a parent delete never orphans anything.
    for (const id of createdCardIds.reverse()) {
      try {
        const deleted = await callJson(client, 'delete_card', { cardId: id });
        console.log(`  deleted ${deleted.deleted?.name ?? id}`);
      } catch (error) {
        console.log(`  FAILED to delete ${id}: ${error.message}`);
        failures.push(`cleanup of card ${id}`);
      }
    }

    await client.close();
  }

  console.log(`\n${passed} checks passed, ${failures.length} failed.`);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.log(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log('SMOKE TEST PASSED');
}

main().catch((error) => {
  console.error(`\nSMOKE TEST ERROR: ${error?.stack || error?.message || error}`);
  process.exit(1);
});
