/*!
 * Copyright (c) 2024 PLANKA Software GmbH
 * Licensed under the Fair Use License: https://github.com/plankanban/planka/blob/master/LICENSE.md
 */

export const SortOrders = {
  ASC: 'asc',
  DESC: 'desc',
};

export const EditorModes = {
  WYSIWYG: 'wysiwyg',
  MARKUP: 'markup',
};

export const AutoLogoutModes = {
  NEVER: 'never',
  MINUTES_2: '2m',
  MINUTES_5: '5m',
  MINUTES_10: '10m',
  MINUTES_30: '30m',
  HOURS_12: '12h',
};

export const HomeViews = {
  GRID_PROJECTS: 'gridProjects',
  GROUPED_PROJECTS: 'groupedProjects',
};

export const UserRoles = {
  ADMIN: 'admin',
  PROJECT_OWNER: 'projectOwner',
  BOARD_USER: 'boardUser',
};

export const ProjectOrders = {
  BY_DEFAULT: 'byDefault',
  ALPHABETICALLY: 'alphabetically',
  BY_CREATION_TIME: 'byCreationTime',
};

export const ProjectGroups = {
  MY_OWN: 'myOwn',
  TEAM: 'team',
  SHARED_WITH_ME: 'sharedWithMe',
  OTHERS: 'others',
};

export const ProjectTypes = {
  PRIVATE: 'private',
  SHARED: 'shared',
};

export const ProjectBackgroundTypes = {
  GRADIENT: 'gradient',
  IMAGE: 'image',
};

export const BoardViews = {
  KANBAN: 'kanban',
  GRID: 'grid',
  LIST: 'list',
  TABLE: 'table',
  TIMELINE: 'timeline',
};

export const BoardContexts = {
  BOARD: 'board',
  ARCHIVE: 'archive',
  TRASH: 'trash',
};

// planka-bowe — `plankaJson` is a board exported by this app
export const BoardImportTypes = {
  TRELLO: 'trello',
  PLANKA_JSON: 'plankaJson',
};

export const BoardMembershipRoles = {
  EDITOR: 'editor',
  VIEWER: 'viewer',
};

export const ListTypes = {
  ACTIVE: 'active',
  CLOSED: 'closed',
  ARCHIVE: 'archive',
  TRASH: 'trash',
};

export const ListTypeStates = {
  OPENED: 'opened',
  CLOSED: 'closed',
};

export const ListSortFieldNames = {
  NAME: 'name',
  DUE_DATE: 'dueDate',
  CREATED_AT: 'createdAt',
};

export const CardTypes = {
  PROJECT: 'project',
  STORY: 'story',
};

// planka-bowe — goals
export const GoalStatuses = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DONE: 'done',
};

// planka-bowe — card priority
export const CardPriorities = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const CARD_PRIORITY_RANK = {
  [CardPriorities.LOW]: 1,
  [CardPriorities.MEDIUM]: 2,
  [CardPriorities.HIGH]: 3,
  [CardPriorities.URGENT]: 4,
};

// planka-bowe — board filters (client-only, per board)
export const CardDueFilters = {
  OVERDUE: 'overdue',
  TODAY: 'today',
  THIS_WEEK: 'thisWeek',
  NO_DATE: 'noDate',
};

export const CardStatusFilters = {
  OPEN: 'open',
  DONE: 'done',
};

// planka-bowe — card color accent
export const CardColors = [
  'berry',
  'coral',
  'amber',
  'lime',
  'teal',
  'sky',
  'indigo',
  'violet',
  'slate',
  'rose',
];

export const AttachmentTypes = {
  FILE: 'file',
  LINK: 'link',
};

export const ActivityTypes = {
  CREATE_CARD: 'createCard',
  MOVE_CARD: 'moveCard',
  ADD_MEMBER_TO_CARD: 'addMemberToCard',
  REMOVE_MEMBER_FROM_CARD: 'removeMemberFromCard',
  COMPLETE_TASK: 'completeTask',
  UNCOMPLETE_TASK: 'uncompleteTask',
};

export const NotificationTypes = {
  MOVE_CARD: 'moveCard',
  COMMENT_CARD: 'commentCard',
  ADD_MEMBER_TO_CARD: 'addMemberToCard',
  MENTION_IN_COMMENT: 'mentionInComment',
};

export const NotificationServiceFormats = {
  TEXT: 'text',
  MARKDOWN: 'markdown',
  HTML: 'html',
};
