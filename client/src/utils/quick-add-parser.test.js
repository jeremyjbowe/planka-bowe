import { parseQuickAdd } from './quick-add-parser';
import { CardPriorities } from '../constants/Enums';

const NOW = new Date('2026-09-08T10:00:00');

const USERS = [
  { id: 'user-1', username: 'jeremy', name: 'Jeremy Bowe' },
  { id: 'user-2', username: 'alice', name: 'Alice Smith' },
];

const LABELS = [
  { id: 'label-1', name: 'billing' },
  { id: 'label-2', name: 'needs review' },
];

const PROJECTS = [
  { id: 'project-1', name: 'Website' },
  { id: 'project-2', name: 'Marketing' },
];

describe('parseQuickAdd', () => {
  test('passes plain titles straight through', () => {
    const result = parseQuickAdd('Fix invoice bug', { now: NOW });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.userIds).toEqual([]);
    expect(result.labelIds).toEqual([]);
    expect(result.priority).toBeNull();
    expect(result.projectId).toBeNull();
    expect(result.dueDate).toBeNull();
    expect(result.unresolved).toEqual([]);
  });

  test('extracts a natural-language date and time, stripping it from the title', () => {
    const result = parseQuickAdd('Fix invoice bug tomorrow at 5pm', { now: NOW });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.dueDate).toBeInstanceOf(Date);
    expect(result.dueDate.getFullYear()).toBe(2026);
    expect(result.dueDate.getMonth()).toBe(8); // September
    expect(result.dueDate.getDate()).toBe(9);
    expect(result.dueDate.getHours()).toBe(17);
    expect(result.dueDateText.toLowerCase()).toContain('tomorrow');
  });

  test('extracts a relative weekday date, defaulting to the start of the working day', () => {
    const result = parseQuickAdd('Plan sprint next friday', { now: NOW });

    expect(result.name).toBe('Plan sprint');
    expect(result.dueDate).toBeInstanceOf(Date);

    // "next friday" from Tue 2026-09-08 with no explicit time.
    expect(result.dueDate.getDay()).toBe(5); // Friday
    expect(result.dueDate.getTime()).toBeGreaterThan(NOW.getTime());
    expect(result.dueDate.getHours()).toBe(9);
    expect(result.dueDate.getMinutes()).toBe(0);
  });

  test('extracts an @assignee token and removes it from the title', () => {
    const result = parseQuickAdd('Fix invoice bug @jeremy', { now: NOW, users: USERS });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.userIds).toEqual(['user-1']);
    expect(result.unresolved).toEqual([]);
  });

  test('extracts a #label token and removes it from the title', () => {
    const result = parseQuickAdd('Fix invoice bug #billing', { now: NOW, labels: LABELS });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.labelIds).toEqual(['label-1']);
  });

  test('extracts a quoted #label token containing spaces', () => {
    const result = parseQuickAdd('Fix invoice bug #"needs review"', { now: NOW, labels: LABELS });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.labelIds).toEqual(['label-2']);
  });

  test('extracts a !priority token and removes it from the title', () => {
    const result = parseQuickAdd('Fix invoice bug !high', { now: NOW });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.priority).toBe(CardPriorities.HIGH);
  });

  test('extracts a ~project token and removes it from the title', () => {
    const result = parseQuickAdd('Fix invoice bug ~Website', { now: NOW, projects: PROJECTS });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.projectId).toBe('project-1');
  });

  test('combines multiple tokens plus a date in one input', () => {
    const result = parseQuickAdd(
      'Fix invoice bug @jeremy #billing !high ~Website tomorrow at 5pm',
      {
        now: NOW,
        users: USERS,
        labels: LABELS,
        projects: PROJECTS,
      },
    );

    expect(result.name).toBe('Fix invoice bug');
    expect(result.userIds).toEqual(['user-1']);
    expect(result.labelIds).toEqual(['label-1']);
    expect(result.priority).toBe(CardPriorities.HIGH);
    expect(result.projectId).toBe('project-1');
    expect(result.dueDate).toBeInstanceOf(Date);
    expect(result.dueDate.getHours()).toBe(17);
    expect(result.unresolved).toEqual([]);
  });

  test('reports unresolved tokens that cannot be matched against the provided data', () => {
    const result = parseQuickAdd('Fix invoice bug @nobody #missing !bogus ~nowhere', {
      now: NOW,
      users: USERS,
      labels: LABELS,
      projects: PROJECTS,
    });

    expect(result.name).toBe('Fix invoice bug');
    expect(result.userIds).toEqual([]);
    expect(result.labelIds).toEqual([]);
    expect(result.priority).toBeNull();
    expect(result.projectId).toBeNull();
    expect(result.unresolved).toEqual(['@nobody', '#missing', '!bogus', '~nowhere']);
  });

  test('does not throw on empty input', () => {
    expect(() => parseQuickAdd('', { now: NOW })).not.toThrow();

    const result = parseQuickAdd('', { now: NOW });
    expect(result.name).toBe('');
    expect(result.dueDate).toBeNull();
  });

  test('does not throw on undefined/null input', () => {
    expect(() => parseQuickAdd(undefined)).not.toThrow();
    expect(() => parseQuickAdd(null)).not.toThrow();

    expect(parseQuickAdd(undefined).name).toBe('');
    expect(parseQuickAdd(null).name).toBe('');
  });

  test('does not throw when called with no options at all', () => {
    expect(() => parseQuickAdd('Just a title')).not.toThrow();
    expect(parseQuickAdd('Just a title').name).toBe('Just a title');
  });

  test('is not confused by tokens that cannot resolve because no data was given', () => {
    const result = parseQuickAdd('Fix invoice bug @jeremy #billing', { now: NOW });

    expect(result.userIds).toEqual([]);
    expect(result.labelIds).toEqual([]);
    expect(result.unresolved).toEqual(['@jeremy', '#billing']);
  });
});
