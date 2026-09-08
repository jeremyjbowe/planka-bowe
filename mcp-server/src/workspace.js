/**
 * Instance-wide lookups: the project/board tree and username resolution.
 *
 * `GET /api/projects` returns every project the account can see plus their
 * boards in `included`, so one call answers "what is there?".
 */

import { compact, indexById } from './util.js';

export class Workspace {
  constructor(payload) {
    this.projects = payload.items || [];
    this.boards = payload.included?.boards || [];
    this.users = payload.included?.users || [];

    this.projectById = indexById(this.projects);
    this.boardById = indexById(this.boards);
  }

  boardsOfProject(projectId) {
    return this.boards
      .filter((board) => board.projectId === projectId)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((board) => ({ id: board.id, name: board.name }));
  }

  /** Every readable board id, for tools that sweep the whole instance. */
  allBoardIds() {
    return this.boards.map((board) => board.id);
  }

  projectNameOfBoard(boardId) {
    const board = this.boardById.get(boardId);
    if (!board) {
      return null;
    }
    return this.projectById.get(board.projectId)?.name ?? null;
  }

  boardName(boardId) {
    return this.boardById.get(boardId)?.name ?? null;
  }

  /** Nested parent/child project tree, each node carrying its boards. */
  tree() {
    const childrenByParent = new Map();

    for (const project of this.projects) {
      const parent = project.parentProjectId || null;
      if (!childrenByParent.has(parent)) {
        childrenByParent.set(parent, []);
      }
      childrenByParent.get(parent).push(project);
    }

    const build = (project, depth) =>
      compact({
        id: project.id,
        name: project.name,
        description: project.description,
        boards: this.boardsOfProject(project.id),
        children:
          depth < 8
            ? (childrenByParent.get(project.id) || []).map((child) => build(child, depth + 1))
            : [],
      });

    // Roots are projects with no parent, or whose parent is not visible here.
    const roots = this.projects.filter(
      (project) => !project.parentProjectId || !this.projectById.has(project.parentProjectId),
    );

    return roots.map((project) => build(project, 0));
  }
}

export async function loadWorkspace(client) {
  return new Workspace(await client.get('/api/projects'));
}

let userCache = null;

/** All users on the instance, cached for the life of the process. */
export async function loadUsers(client, { fresh = false } = {}) {
  if (!userCache || fresh) {
    const payload = await client.get('/api/users');
    userCache = payload.items || [];
  }
  return userCache;
}

/**
 * Resolve a username (people are always addressed by username, never id) to a
 * user id. Throws with the list of known usernames when there is no match.
 */
export async function resolveUserId(client, username) {
  const users = await loadUsers(client);
  const wanted = String(username).trim().toLowerCase();

  const match = users.find(
    (user) =>
      (user.username || '').toLowerCase() === wanted ||
      (user.email || '').toLowerCase() === wanted,
  );

  if (!match) {
    const known = users
      .filter((user) => !user.isDeactivated)
      .map((user) => user.username)
      .join(', ');
    throw new Error(`No user named "${username}". Known usernames: ${known}`);
  }

  return match.id;
}

export async function usernameById(client, userId) {
  const users = await loadUsers(client);
  return users.find((user) => user.id === userId)?.username ?? null;
}
