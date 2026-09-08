/**
 * Small shared helpers: date parsing/bucketing, list positions, and the
 * compact JSON envelope every tool returns.
 */

export const POSITION_STEP = 65536;

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Highest first, so a plain sort puts urgent work at the top.
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

export function priorityRank(priority) {
  return PRIORITY_RANK[priority] ?? 4;
}

/** Card accent colours accepted by the fork (Card.Colors). */
export const CARD_COLORS = [
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

/** Label palette (Label.COLORS). The first few read as soft/neutral. */
export const LABEL_COLORS = [
  'muddy-grey',
  'autumn-leafs',
  'morning-sky',
  'antique-blue',
  'egg-yellow',
  'desert-sand',
  'dark-granite',
  'fresh-salad',
  'lagoon-blue',
  'midnight-blue',
  'light-orange',
  'pumpkin-orange',
  'light-concrete',
  'sunny-grass',
  'navy-blue',
  'lilac-eyes',
  'apricot-red',
  'orange-peel',
  'silver-glint',
  'bright-moss',
  'deep-ocean',
  'summer-sky',
  'berry-red',
  'light-cocoa',
  'grey-stone',
  'tank-green',
  'coral-green',
  'sugar-plum',
  'pink-tulip',
];

/** A muted default for labels the tools create implicitly. */
export const DEFAULT_LABEL_COLOR = 'morning-sky';

/**
 * Turn a user-supplied date into the strict ISO 8601 string the API demands.
 *
 * Accepts:
 *   - a full ISO timestamp ("2026-09-15T14:30:00.000Z") - passed through
 *   - a bare date ("2026-09-15") - becomes 12:00 local time on that day, so it
 *     still reads as that date in the owner's timezone
 *   - "YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM" - local time
 *   - "today", "tomorrow", "yesterday" - 12:00 local
 */
export function parseDateInput(value, { field = 'date' } = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }

  const raw = value.trim();
  const lowered = raw.toLowerCase();

  if (lowered === 'today' || lowered === 'tomorrow' || lowered === 'yesterday') {
    const offset = lowered === 'tomorrow' ? 1 : lowered === 'yesterday' ? -1 : 0;
    const date = new Date();
    date.setDate(date.getDate() + offset);
    date.setHours(12, 0, 0, 0);
    return date.toISOString();
  }

  // Bare calendar date.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const date = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3]),
      12,
      0,
      0,
      0,
    );
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${field} is not a real date: ${raw}`);
    }
    return date.toISOString();
  }

  // Date plus wall-clock time, no zone: treat as local.
  const localDateTime = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (localDateTime) {
    const date = new Date(
      Number(localDateTime[1]),
      Number(localDateTime[2]) - 1,
      Number(localDateTime[3]),
      Number(localDateTime[4]),
      Number(localDateTime[5]),
      Number(localDateTime[6] || 0),
      0,
    );
    if (Number.isNaN(date.getTime())) {
      throw new Error(`${field} is not a real date: ${raw}`);
    }
    return date.toISOString();
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `${field} could not be understood: "${raw}". Use ISO 8601 (2026-09-15T14:30:00Z), ` +
        'a plain date (2026-09-15), or "today"/"tomorrow".',
    );
  }

  return parsed.toISOString();
}

export function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/** Week boundaries with a Sunday start, matching date-fns defaults in the UI. */
export function startOfWeek(date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

export function endOfWeek(date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return endOfDay(next);
}

/**
 * Decide whether a card matches a `due` filter expression.
 * Supported: overdue | today | this_week | next_7_days | no_date |
 *            before:<date> | after:<date>
 */
export function matchesDueFilter(card, filter, now = new Date()) {
  if (!filter) {
    return true;
  }

  const dueDate = card.dueDate ? new Date(card.dueDate) : null;
  const hasDue = dueDate && !Number.isNaN(dueDate.getTime());

  if (filter === 'no_date') {
    return !hasDue;
  }

  if (!hasDue) {
    return false;
  }

  switch (filter) {
    case 'overdue':
      return !card.isClosed && !card.isDueCompleted && dueDate.getTime() < now.getTime();
    case 'today':
      return dueDate >= startOfDay(now) && dueDate <= endOfDay(now);
    case 'this_week':
      return dueDate >= startOfWeek(now) && dueDate <= endOfWeek(now);
    case 'next_7_days': {
      const horizon = endOfDay(new Date(now.getTime() + 6 * 86400000));
      return dueDate >= startOfDay(now) && dueDate <= horizon;
    }
    default:
      break;
  }

  const before = /^before:(.+)$/i.exec(filter);
  if (before) {
    return dueDate.getTime() < new Date(parseDateInput(before[1], { field: 'due' })).getTime();
  }

  const after = /^after:(.+)$/i.exec(filter);
  if (after) {
    return dueDate.getTime() > new Date(parseDateInput(after[1], { field: 'due' })).getTime();
  }

  throw new Error(
    `Unknown due filter "${filter}". Use overdue, today, this_week, next_7_days, ` +
      'no_date, before:<date> or after:<date>.',
  );
}

export function isOverdue(card, now = new Date()) {
  if (!card.dueDate || card.isClosed || card.isDueCompleted) {
    return false;
  }
  const date = new Date(card.dueDate);
  return !Number.isNaN(date.getTime()) && date.getTime() < now.getTime();
}

/** Next position at the bottom of a set of positioned records. */
export function bottomPosition(records) {
  const positions = (records || [])
    .map((record) => record.position)
    .filter((position) => typeof position === 'number' && Number.isFinite(position));

  if (positions.length === 0) {
    return POSITION_STEP;
  }

  return Math.max(...positions) + POSITION_STEP;
}

/** Drop null/undefined/empty-array members so payloads stay small. */
export function compact(object) {
  const result = {};

  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }
    result[key] = value;
  }

  return result;
}

/** Standard MCP text result carrying compact JSON. */
export function jsonResult(payload) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 1) }],
  };
}

export function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

export function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

export function indexById(records) {
  const map = new Map();
  for (const record of records || []) {
    map.set(record.id, record);
  }
  return map;
}

export function groupBy(records, keyOf) {
  const map = new Map();
  for (const record of records || []) {
    const key = keyOf(record);
    if (key === null || key === undefined) {
      continue;
    }
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(record);
  }
  return map;
}
