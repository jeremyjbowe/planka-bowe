/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

import { createSelector } from 'redux-orm';

import orm from '../orm';
import { UserRoles } from '../constants/Enums';
import { selectIsHiddenProjectsVisible } from './core';
import { selectPath } from './router';
import { selectCurrentUserId } from './users';
import { isLocalId } from '../utils/local-id';

export const makeSelectProjectById = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Project }, id) => {
      const projectModel = Project.withId(id);

      if (!projectModel) {
        return projectModel;
      }

      return projectModel.ref;
    },
  );

export const selectProjectById = makeSelectProjectById();

export const makeSelectBoardIdsByProjectId = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectCurrentUserId(state),
    ({ Project, User }, id, currentUserId) => {
      if (!id) {
        return id;
      }

      const projectModel = Project.withId(id);

      if (!projectModel) {
        return projectModel;
      }

      const currentUserModel = User.withId(currentUserId);

      return projectModel
        .getBoardsModelArrayAvailableForUser(currentUserModel)
        .map((boardModel) => boardModel.id);
    },
  );

export const selectBoardIdsByProjectId = makeSelectBoardIdsByProjectId();

export const makeSelectFirstBoardIdByProjectId = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectCurrentUserId(state),
    ({ Project, User }, id, currentUserId) => {
      const projectModel = Project.withId(id);

      if (!projectModel) {
        return projectModel;
      }

      const currentUserModel = User.withId(currentUserId);
      const boardsModels = projectModel.getBoardsModelArrayAvailableForUser(currentUserModel);

      return boardsModels[0] && boardsModels[0].id;
    },
  );

export const selectFirstBoardIdByProjectId = makeSelectFirstBoardIdByProjectId();

export const makeSelectNotificationsTotalByProjectId = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectCurrentUserId(state),
    ({ Project, User }, id, currentUserId) => {
      const projectModel = Project.withId(id);

      if (!projectModel) {
        return projectModel;
      }

      const currentUserModel = User.withId(currentUserId);
      const boardsModels = projectModel.getBoardsModelArrayAvailableForUser(currentUserModel);

      return boardsModels.reduce(
        (result, boardModel) => result + boardModel.getUnreadNotificationsQuerySet().count(),
        0,
      );
    },
  );

export const selectNotificationsTotalByProjectId = makeSelectNotificationsTotalByProjectId();

export const makeSelectIsProjectWithIdAvailableForCurrentUser = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectCurrentUserId(state),
    ({ Project, User }, id, currentUserId) => {
      const projectModel = Project.withId(id);

      if (!projectModel) {
        return false;
      }

      const currentUserModel = User.withId(currentUserId);
      return projectModel.isAvailableForUser(currentUserModel);
    },
  );

export const selectIsProjectWithIdAvailableForCurrentUser =
  makeSelectIsProjectWithIdAvailableForCurrentUser();

export const makeSelectIsProjectWithIdExternalAccessibleForCurrentUser = () =>
  createSelector(
    orm,
    (_, id) => id,
    (state) => selectCurrentUserId(state),
    ({ Project, User }, id, currentUserId) => {
      const projectModel = Project.withId(id);

      if (!projectModel) {
        return false;
      }

      const currentUserModel = User.withId(currentUserId);
      return projectModel.isExternalAccessibleForUser(currentUserModel);
    },
  );

export const selectIsProjectWithIdExternalAccessibleForCurrentUser =
  makeSelectIsProjectWithIdExternalAccessibleForCurrentUser();

/*
 * DTP fork — hierarchical projects.
 *
 * Builds the sidebar tree from the projects the current user can see. A
 * project whose parent is not visible to the user is shown as a root, so
 * nothing ever disappears because of permissions.
 */
const compareByName = (projectA, projectB) =>
  projectA.name.localeCompare(projectB.name, undefined, { sensitivity: 'base' });

export const selectProjectTreeForCurrentUser = createSelector(
  orm,
  (state) => selectCurrentUserId(state),
  (state) => selectIsHiddenProjectsVisible(state),
  ({ User }, currentUserId, isHiddenProjectsVisible) => {
    if (!currentUserId) {
      return [];
    }

    const currentUserModel = User.withId(currentUserId);

    if (!currentUserModel) {
      return [];
    }

    const projectModels = currentUserModel
      .getProjectsModelArray()
      .filter((projectModel) => isHiddenProjectsVisible || !projectModel.isHidden);

    const visibleIds = new Set(projectModels.map((projectModel) => projectModel.id));

    const nodeById = {};
    projectModels.forEach((projectModel) => {
      nodeById[projectModel.id] = {
        id: projectModel.id,
        name: projectModel.name,
        isFavorite: projectModel.isFavorite,
        isHidden: projectModel.isHidden,
        parentProjectId: projectModel.parentProjectId,
        boards: projectModel
          .getBoardsModelArrayAvailableForUser(currentUserModel)
          .map((boardModel) => ({ id: boardModel.id, name: boardModel.name })),
        children: [],
      };
    });

    const roots = [];
    projectModels.forEach((projectModel) => {
      const node = nodeById[projectModel.id];

      if (projectModel.parentProjectId && visibleIds.has(projectModel.parentProjectId)) {
        nodeById[projectModel.parentProjectId].children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortTree = (nodes) => {
      nodes.sort(compareByName);
      nodes.forEach((node) => sortTree(node.children));
    };

    sortTree(roots);

    return roots;
  },
);

// Ancestors of a project, nearest first, limited to what the user can see.
export const makeSelectAncestorProjectsByProjectId = () =>
  createSelector(
    orm,
    (_, id) => id,
    ({ Project }, id) => {
      const ancestors = [];
      let projectModel = id ? Project.withId(id) : null;

      while (projectModel && projectModel.parentProjectId && ancestors.length < 32) {
        const parentModel = Project.withId(projectModel.parentProjectId);

        if (!parentModel || ancestors.some((ancestor) => ancestor.id === parentModel.id)) {
          break;
        }

        ancestors.push(parentModel.ref);
        projectModel = parentModel;
      }

      return ancestors;
    },
  );

export const selectAncestorProjectsForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    const ancestors = [];
    let projectModel = id ? Project.withId(id) : null;

    while (projectModel && projectModel.parentProjectId && ancestors.length < 32) {
      const parentModel = Project.withId(projectModel.parentProjectId);

      if (!parentModel || ancestors.some((ancestor) => ancestor.id === parentModel.id)) {
        break;
      }

      ancestors.push(parentModel.ref);
      projectModel = parentModel;
    }

    return ancestors;
  },
);

// Projects the current user manages that could become the parent of the
// current project (everything except itself and its descendants).
export const selectParentProjectCandidatesForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  (state) => selectCurrentUserId(state),
  ({ Project, User }, id, currentUserId) => {
    if (!id || !currentUserId) {
      return [];
    }

    const currentUserModel = User.withId(currentUserId);

    if (!currentUserModel) {
      return [];
    }

    const excludedIds = new Set();
    const queue = [id];

    while (queue.length > 0) {
      const currentId = queue.shift();

      if (!excludedIds.has(currentId)) {
        excludedIds.add(currentId);

        const projectModel = Project.withId(currentId);

        if (projectModel) {
          queue.push(...projectModel.subprojects.toRefArray().map((subproject) => subproject.id));
        }
      }
    }

    const candidates = currentUserModel.getManagerProjectsModelArray();

    if (currentUserModel.role === UserRoles.ADMIN) {
      const candidateIds = new Set(candidates.map((projectModel) => projectModel.id));

      Project.getSharedQuerySet()
        .toModelArray()
        .forEach((projectModel) => {
          if (!candidateIds.has(projectModel.id)) {
            candidates.push(projectModel);
          }
        });
    }

    return candidates
      .filter((projectModel) => !excludedIds.has(projectModel.id))
      .map((projectModel) => projectModel.ref)
      .sort(compareByName);
  },
);

export const selectCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    return projectModel.ref;
  },
);

export const selectManagersForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    return projectModel
      .getManagersQuerySet()
      .toModelArray()
      .map((projectManagerModel) => ({
        ...projectManagerModel.ref,
        isPersisted: !isLocalId(projectManagerModel.id),
        user: projectManagerModel.user.ref,
      }));
  },
);

export const selectManagerUserIdsForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    return projectModel
      .getManagersQuerySet()
      .toRefArray()
      .map((projectManager) => projectManager.userId);
  },
);

export const selectBackgroundImageIdsForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    return projectModel
      .getBackgroundImagesQuerySet()
      .toRefArray()
      .map((backgroundImage) => backgroundImage.id);
  },
);

export const selectBaseCustomFieldGroupIdsForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    return projectModel
      .getBaseCustomFieldGroupsQuerySet()
      .toRefArray()
      .map((baseCustomFieldGroup) => baseCustomFieldGroup.id);
  },
);

export const selectBaseCustomFieldGroupsForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  ({ Project }, id) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    return projectModel
      .getBaseCustomFieldGroupsQuerySet()
      .toRefArray()
      .map((baseCustomFieldGroup) => ({
        ...baseCustomFieldGroup,
        isPersisted: !isLocalId(baseCustomFieldGroup.id),
      }));
  },
);

export const selectBoardIdsForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  (state) => selectCurrentUserId(state),
  ({ Project, User }, id, currentUserId) => {
    if (!id) {
      return id;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return projectModel;
    }

    const currentUserModel = User.withId(currentUserId);

    return projectModel
      .getBoardsModelArrayAvailableForUser(currentUserModel)
      .map((boardModel) => boardModel.id);
  },
);

export const selectIsCurrentUserManagerForCurrentProject = createSelector(
  orm,
  (state) => selectPath(state).projectId,
  (state) => selectCurrentUserId(state),
  ({ Project }, id, currentUserId) => {
    if (!id) {
      return false;
    }

    const projectModel = Project.withId(id);

    if (!projectModel) {
      return false;
    }

    return projectModel.hasManagerWithUserId(currentUserId);
  },
);

export default {
  makeSelectProjectById,
  selectProjectById,
  makeSelectBoardIdsByProjectId,
  selectBoardIdsByProjectId,
  makeSelectFirstBoardIdByProjectId,
  selectFirstBoardIdByProjectId,
  makeSelectNotificationsTotalByProjectId,
  selectNotificationsTotalByProjectId,
  makeSelectIsProjectWithIdAvailableForCurrentUser,
  selectIsProjectWithIdAvailableForCurrentUser,
  makeSelectIsProjectWithIdExternalAccessibleForCurrentUser,
  selectIsProjectWithIdExternalAccessibleForCurrentUser,
  selectCurrentProject,
  selectProjectTreeForCurrentUser,
  makeSelectAncestorProjectsByProjectId,
  selectAncestorProjectsForCurrentProject,
  selectParentProjectCandidatesForCurrentProject,
  selectManagersForCurrentProject,
  selectManagerUserIdsForCurrentProject,
  selectBackgroundImageIdsForCurrentProject,
  selectBaseCustomFieldGroupIdsForCurrentProject,
  selectBaseCustomFieldGroupsForCurrentProject,
  selectBoardIdsForCurrentProject,
  selectIsCurrentUserManagerForCurrentProject,
};
