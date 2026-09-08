import filterCards from './filter-cards';
import { CardDueFilters, CardPriorities, CardStatusFilters } from '../constants/Enums';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const refArray = (items) => ({
  toRefArray: () => items,
});

const taskListsQuerySet = (taskLists) => ({
  toModelArray: () => taskLists,
});

const tasksQuerySet = (tasks) => ({
  toRefArray: () => tasks,
});

const makeTaskList = (tasks = []) => ({
  getTasksQuerySet: () => tasksQuerySet(tasks),
});

const makeCard = ({
  id,
  name,
  description = null,
  users = [],
  labels = [],
  taskLists = [],
  dueDate = null,
  isDueCompleted = false,
  priority = null,
  isClosed = false,
} = {}) => ({
  id,
  name,
  description,
  users: refArray(users),
  labels: refArray(labels),
  getTaskListsQuerySet: () => taskListsQuerySet(taskLists),
  dueDate,
  isDueCompleted,
  priority,
  isClosed,
});

const makeBoard = (overrides = {}) => ({
  search: null,
  filterDue: null,
  filterPriorities: [],
  filterStatus: null,
  filterAssignedToMe: false,
  filterCurrentUserId: null,
  filterUsers: refArray([]),
  filterLabels: refArray([]),
  ...overrides,
});

const USER_A = { id: 'user-a' };
const USER_B = { id: 'user-b' };

const LABEL_RED = { id: 'label-red' };
const LABEL_BLUE = { id: 'label-blue' };

describe('filterCards', () => {
  test('returns all cards when the filter is empty', () => {
    const cards = [
      makeCard({ id: 'card-1', name: 'Alpha' }),
      makeCard({ id: 'card-2', name: 'Beta' }),
    ];

    const result = filterCards(cards, makeBoard());

    expect(result).toEqual(cards);
  });

  test('returns an empty array unchanged without touching the board', () => {
    const result = filterCards([], makeBoard());
    expect(result).toEqual([]);
  });

  describe('member filter', () => {
    test('matches cards where a card member is in the filter', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', users: [USER_A] }),
        makeCard({ id: 'card-2', name: 'Beta', users: [USER_B] }),
      ];

      const board = makeBoard({ filterUsers: refArray([USER_A]) });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('matches cards where a task assignee is in the filter (OR over card members)', () => {
      const cards = [
        makeCard({
          id: 'card-1',
          name: 'Alpha',
          users: [],
          taskLists: [makeTaskList([{ assigneeUserId: 'user-a' }])],
        }),
        makeCard({ id: 'card-2', name: 'Beta', users: [] }),
      ];

      const board = makeBoard({ filterUsers: refArray([USER_A]) });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });
  });

  describe('label filter', () => {
    test('matches cards with any of the filtered labels (OR)', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', labels: [LABEL_RED] }),
        makeCard({ id: 'card-2', name: 'Beta', labels: [LABEL_BLUE] }),
        makeCard({ id: 'card-3', name: 'Gamma', labels: [] }),
      ];

      const board = makeBoard({ filterLabels: refArray([LABEL_RED, LABEL_BLUE]) });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1', 'card-2']);
    });
  });

  describe('priority filter', () => {
    test('matches cards whose priority is in the filter', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', priority: CardPriorities.HIGH }),
        makeCard({ id: 'card-2', name: 'Beta', priority: CardPriorities.LOW }),
        makeCard({ id: 'card-3', name: 'Gamma', priority: null }),
      ];

      const board = makeBoard({ filterPriorities: [CardPriorities.HIGH, CardPriorities.URGENT] });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });
  });

  describe('due date filter', () => {
    const now = new Date();

    test('OVERDUE matches cards with a past due date that are not completed', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', dueDate: new Date(now.getTime() - DAY) }),
        makeCard({
          id: 'card-2',
          name: 'Beta',
          dueDate: new Date(now.getTime() - DAY),
          isDueCompleted: true,
        }),
        makeCard({ id: 'card-3', name: 'Gamma', dueDate: new Date(now.getTime() + DAY) }),
        makeCard({ id: 'card-4', name: 'Delta', dueDate: null }),
      ];

      const board = makeBoard({ filterDue: CardDueFilters.OVERDUE });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('TODAY matches cards due within today', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', dueDate: now }),
        makeCard({ id: 'card-2', name: 'Beta', dueDate: new Date(now.getTime() + 2 * DAY) }),
        makeCard({ id: 'card-3', name: 'Gamma', dueDate: null }),
      ];

      const board = makeBoard({ filterDue: CardDueFilters.TODAY });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('NO_DATE matches only cards without a due date', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', dueDate: null }),
        makeCard({ id: 'card-2', name: 'Beta', dueDate: now }),
      ];

      const board = makeBoard({ filterDue: CardDueFilters.NO_DATE });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('ignores an unparsable due date rather than throwing', () => {
      const cards = [makeCard({ id: 'card-1', name: 'Alpha', dueDate: 'not-a-date' })];

      const board = makeBoard({ filterDue: CardDueFilters.OVERDUE });

      expect(() => filterCards(cards, board)).not.toThrow();
      expect(filterCards(cards, board)).toEqual([]);
    });
  });

  describe('status filter', () => {
    test('OPEN matches non-closed cards, DONE matches closed cards', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', isClosed: false }),
        makeCard({ id: 'card-2', name: 'Beta', isClosed: true }),
      ];

      expect(
        filterCards(cards, makeBoard({ filterStatus: CardStatusFilters.OPEN })).map(
          (card) => card.id,
        ),
      ).toEqual(['card-1']);

      expect(
        filterCards(cards, makeBoard({ filterStatus: CardStatusFilters.DONE })).map(
          (card) => card.id,
        ),
      ).toEqual(['card-2']);
    });
  });

  describe('assigned to me filter', () => {
    test('matches only cards where the current user is a member', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', users: [USER_A] }),
        makeCard({ id: 'card-2', name: 'Beta', users: [USER_B] }),
      ];

      const board = makeBoard({ filterAssignedToMe: true, filterCurrentUserId: 'user-a' });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('is a no-op when there is no current user id', () => {
      const cards = [makeCard({ id: 'card-1', name: 'Alpha', users: [] })];

      const board = makeBoard({ filterAssignedToMe: true, filterCurrentUserId: null });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });
  });

  describe('text search', () => {
    test('is case-insensitive over the name', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Fix Invoice Bug' }),
        makeCard({ id: 'card-2', name: 'Write docs' }),
      ];

      const board = makeBoard({ search: 'INVOICE' });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('matches across the description too', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Alpha', description: 'Needs billing review' }),
        makeCard({ id: 'card-2', name: 'Beta', description: null }),
      ];

      const board = makeBoard({ search: 'billing' });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('requires every whitespace-separated search part to match (AND)', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'Fix invoice bug' }),
        makeCard({ id: 'card-2', name: 'Fix login bug' }),
      ];

      const board = makeBoard({ search: 'fix bug invoice' });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('supports a /regex search that is case-insensitive', () => {
      const cards = [
        makeCard({ id: 'card-1', name: 'INV-001' }),
        makeCard({ id: 'card-2', name: 'Something else' }),
      ];

      const board = makeBoard({ search: '/inv-\\d+' });
      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });

    test('returns no cards for an invalid /regex search instead of throwing', () => {
      const cards = [makeCard({ id: 'card-1', name: 'Alpha' })];

      const board = makeBoard({ search: '/[' });

      expect(() => filterCards(cards, board)).not.toThrow();
      expect(filterCards(cards, board)).toEqual([]);
    });
  });

  describe('combined filters', () => {
    test('ANDs search, member, label, priority and status together', () => {
      const cards = [
        makeCard({
          id: 'card-1',
          name: 'Fix invoice bug',
          users: [USER_A],
          labels: [LABEL_RED],
          priority: CardPriorities.HIGH,
          isClosed: false,
        }),
        // Wrong priority.
        makeCard({
          id: 'card-2',
          name: 'Fix invoice bug',
          users: [USER_A],
          labels: [LABEL_RED],
          priority: CardPriorities.LOW,
          isClosed: false,
        }),
        // Wrong member.
        makeCard({
          id: 'card-3',
          name: 'Fix invoice bug',
          users: [USER_B],
          labels: [LABEL_RED],
          priority: CardPriorities.HIGH,
          isClosed: false,
        }),
        // Wrong text.
        makeCard({
          id: 'card-4',
          name: 'Write docs',
          users: [USER_A],
          labels: [LABEL_RED],
          priority: CardPriorities.HIGH,
          isClosed: false,
        }),
        // Closed, so fails the OPEN status filter.
        makeCard({
          id: 'card-5',
          name: 'Fix invoice bug',
          users: [USER_A],
          labels: [LABEL_RED],
          priority: CardPriorities.HIGH,
          isClosed: true,
        }),
      ];

      const board = makeBoard({
        search: 'invoice',
        filterUsers: refArray([USER_A]),
        filterLabels: refArray([LABEL_RED]),
        filterPriorities: [CardPriorities.HIGH],
        filterStatus: CardStatusFilters.OPEN,
      });

      const result = filterCards(cards, board);

      expect(result.map((card) => card.id)).toEqual(['card-1']);
    });
  });
});
