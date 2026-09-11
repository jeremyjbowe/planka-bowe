/*!
 * planka-bowe — selectors backing Quick Add and the command palette.
 *
 * Everything here is read from the redux-orm store that the rest of the app
 * already keeps in sync over the socket. Card search therefore covers the
 * boards that have been loaded in this session (the current board plus any
 * visited earlier); projects and boards are always fully loaded.
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { selectPath } from './router';
import { selectCurrentUserId } from './users';

// Context the parser resolves @user, #label and ~project tokens against.
export const selectQuickAddContext = createSelector(
  orm,
  (state) => selectPath(state).boardId,
  (state) => selectCurrentUserId(state),
  ({ Board, User }, boardId, currentUserId) => {
    const currentUserModel = currentUserId ? User.withId(currentUserId) : null;
    const boardModel = boardId ? Board.withId(boardId) : null;

    const projects = currentUserModel
      ? currentUserModel.getProjectsModelArray().map((projectModel) => ({
          id: projectModel.id,
          name: projectModel.name,
          firstBoardId: (() => {
            const boards = projectModel.getBoardsModelArrayAvailableForUser(currentUserModel);
            return boards.length > 0 ? boards[0].id : null;
          })(),
        }))
      : [];

    if (!boardModel) {
      return {
        boardId: null,
        defaultCardType: null,
        firstListId: null,
        users: [],
        labels: [],
        projects,
      };
    }

    const firstListModel = boardModel.getKanbanListsQuerySet().first();

    return {
      boardId: boardModel.id,
      defaultCardType: boardModel.defaultCardType,
      firstListId: firstListModel ? firstListModel.id : null,
      users: boardModel.memberUsers.toRefArray().map((user) => ({
        id: user.id,
        name: user.name,
        username: user.username,
      })),
      labels: boardModel.labels.toRefArray().map((label) => ({
        id: label.id,
        name: label.name,
      })),
      projects,
    };
  },
);

// Flat, searchable index of what the client already knows about.
export const selectSearchIndex = createSelector(
  orm,
  (state) => selectCurrentUserId(state),
  ({ User, Card }, currentUserId) => {
    const currentUserModel = currentUserId ? User.withId(currentUserId) : null;

    if (!currentUserModel) {
      return { projects: [], boards: [], cards: [] };
    }

    const projects = [];
    const boards = [];
    const boardNameById = {};

    currentUserModel.getProjectsModelArray().forEach((projectModel) => {
      projects.push({ id: projectModel.id, name: projectModel.name });

      projectModel.getBoardsModelArrayAvailableForUser(currentUserModel).forEach((boardModel) => {
        boardNameById[boardModel.id] = boardModel.name;
        boards.push({
          id: boardModel.id,
          name: boardModel.name,
          projectId: projectModel.id,
          projectName: projectModel.name,
        });
      });
    });

    const cards = Card.all()
      .toModelArray()
      .flatMap((cardModel) => {
        if (!boardNameById[cardModel.boardId]) {
          return [];
        }

        return [
          {
            id: cardModel.id,
            name: cardModel.name,
            boardId: cardModel.boardId,
            boardName: boardNameById[cardModel.boardId],
            listName: cardModel.list ? cardModel.list.name : null,
            isClosed: cardModel.isClosed,
          },
        ];
      });

    return { projects, boards, cards };
  },
);

export default {
  selectQuickAddContext,
  selectSearchIndex,
};
