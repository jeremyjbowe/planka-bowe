/**
 * Turns a raw `GET /api/boards/:id` payload into something small and joined up.
 *
 * The API returns flat `included` collections (lists, cards, labels, users,
 * cardMemberships, cardLabels, taskLists, tasks, ...). Everything here does the
 * joining once so the tools can stay declarative.
 */

import { compact, groupBy, indexById, isOverdue } from './util.js';

/** Lists a card can actually live on in the kanban sense. */
export const OPEN_LIST_TYPES = new Set(['active']);
export const CLOSED_LIST_TYPES = new Set(['closed']);

export class BoardView {
  constructor(payload) {
    const included = payload.included || {};

    this.board = payload.item;
    this.lists = included.lists || [];
    this.cards = included.cards || [];
    this.labels = included.labels || [];
    this.users = included.users || [];
    this.taskLists = included.taskLists || [];
    this.tasks = included.tasks || [];
    this.boardMemberships = included.boardMemberships || [];
    this.projects = included.projects || [];

    this.listById = indexById(this.lists);
    this.labelById = indexById(this.labels);
    this.userById = indexById(this.users);
    this.cardById = indexById(this.cards);
    this.taskListById = indexById(this.taskLists);

    this.cardLabelsByCardId = groupBy(included.cardLabels, (row) => row.cardId);
    this.cardMembershipsByCardId = groupBy(included.cardMemberships, (row) => row.cardId);
    this.taskListsByCardId = groupBy(this.taskLists, (row) => row.cardId);
    this.tasksByTaskListId = groupBy(this.tasks, (row) => row.taskListId);
    this.childCardsByParentId = groupBy(this.cards, (card) => card.parentCardId);
  }

  get boardId() {
    return this.board.id;
  }

  get projectId() {
    return this.board.projectId;
  }

  listName(listId) {
    const list = this.listById.get(listId);
    return list ? list.name || list.type : null;
  }

  username(userId) {
    const user = this.userById.get(userId);
    return user ? user.username : null;
  }

  /** Board members as {username, name}, from boardMemberships. */
  members() {
    return this.boardMemberships
      .map((membership) => {
        const user = this.userById.get(membership.userId);
        if (!user) {
          return null;
        }
        return compact({ username: user.username, name: user.name, role: membership.role });
      })
      .filter(Boolean);
  }

  labelNames(cardId) {
    return (this.cardLabelsByCardId.get(cardId) || [])
      .map((row) => this.labelById.get(row.labelId)?.name)
      .filter(Boolean);
  }

  assignees(cardId) {
    return (this.cardMembershipsByCardId.get(cardId) || [])
      .map((row) => this.username(row.userId))
      .filter(Boolean);
  }

  /** {done, total} across every checklist item on the card. */
  checklistProgress(cardId) {
    let done = 0;
    let total = 0;

    for (const taskList of this.taskListsByCardId.get(cardId) || []) {
      for (const task of this.tasksByTaskListId.get(taskList.id) || []) {
        total += 1;
        if (task.isCompleted) {
          done += 1;
        }
      }
    }

    return { done, total };
  }

  /** {done, total} across child cards (the fork models subtasks as cards). */
  subtaskProgress(cardId) {
    const children = this.childCardsByParentId.get(cardId) || [];
    return {
      done: children.filter((child) => child.isClosed).length,
      total: children.length,
    };
  }

  checklists(cardId) {
    return (this.taskListsByCardId.get(cardId) || [])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((taskList) => ({
        id: taskList.id,
        name: taskList.name,
        items: (this.tasksByTaskListId.get(taskList.id) || [])
          .slice()
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((task) =>
            compact({
              taskId: task.id,
              name: task.name,
              isCompleted: Boolean(task.isCompleted),
              assignee: task.assigneeUserId ? this.username(task.assigneeUserId) : null,
            }),
          ),
      }));
  }

  subtasks(cardId) {
    return (this.childCardsByParentId.get(cardId) || []).map((child) =>
      compact({
        id: child.id,
        name: child.name,
        isDone: Boolean(child.isClosed),
        dueDate: child.dueDate,
        priority: child.priority,
        assignees: this.assignees(child.id),
      }),
    );
  }

  /** The compact per-card shape used by get_board / find_cards / overview. */
  summarizeCard(card, { now = new Date(), boardName = null, projectName = null } = {}) {
    const subtasks = this.subtaskProgress(card.id);
    const checklist = this.checklistProgress(card.id);

    return compact({
      id: card.id,
      name: card.name,
      list: this.listName(card.listId),
      board: boardName,
      project: projectName,
      dueDate: card.dueDate,
      isOverdue: isOverdue(card, now) || undefined,
      priority: card.priority,
      color: card.color,
      labels: this.labelNames(card.id),
      assignees: this.assignees(card.id),
      isDone: Boolean(card.isClosed),
      parentCardId: card.parentCardId,
      subtasks: subtasks.total > 0 ? `${subtasks.done}/${subtasks.total}` : undefined,
      checklist: checklist.total > 0 ? `${checklist.done}/${checklist.total}` : undefined,
      hasRecurrence: card.recurrenceRule ? true : undefined,
    });
  }

  /** Find a list by explicit id or by (case-insensitive) name. */
  resolveList({ listId, listName }) {
    if (listId) {
      const list = this.listById.get(listId);
      if (!list) {
        throw new Error(
          `List ${listId} is not on board ${this.boardId}. Available: ${this.describeLists()}`,
        );
      }
      return list;
    }

    if (listName) {
      const wanted = listName.trim().toLowerCase();
      const match = this.lists.find((list) => (list.name || '').toLowerCase() === wanted);

      if (!match) {
        throw new Error(
          `No list named "${listName}" on board ${this.boardId}. Available: ${this.describeLists()}`,
        );
      }
      return match;
    }

    return null;
  }

  describeLists() {
    return this.lists
      .filter((list) => list.name)
      .map((list) => `${list.name} (${list.type})`)
      .join(', ');
  }

  /** First list a reopened/new card should sit on. */
  firstOpenList() {
    return this.lists
      .filter((list) => OPEN_LIST_TYPES.has(list.type))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  }

  /** The list that means "done" on this board, if it has one. */
  closedList() {
    return this.lists
      .filter((list) => CLOSED_LIST_TYPES.has(list.type))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0];
  }

  cardsInList(listId) {
    return this.cards.filter((card) => card.listId === listId);
  }

  /** Resolve a username to a board user id, for assignment. */
  resolveUsername(username) {
    const wanted = username.trim().toLowerCase();
    const user = this.users.find(
      (candidate) => (candidate.username || '').toLowerCase() === wanted,
    );
    return user ? user.id : null;
  }
}
