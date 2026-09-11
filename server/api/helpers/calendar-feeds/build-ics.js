/*!
 * planka-bowe — calendar feeds.
 *
 * Serializes cards as an iCalendar document (RFC 5545). By default every card
 * becomes a VTODO (due date, completion, priority, labels as categories,
 * recurrence rule, parent relation, link back to the card). In "events" mode
 * cards with a due date become all-day VEVENTs instead, for calendar apps
 * that ignore VTODO components (Apple Calendar, Google Calendar).
 */

const PRIORITY_BY_CARD_PRIORITY = {
  urgent: 1,
  high: 3,
  medium: 5,
  low: 7,
};

const pad = (value) => String(value).padStart(2, '0');

const toUtcStamp = (value) => {
  const date = new Date(value);

  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const toDateOnly = (value, dayOffset = 0) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + dayOffset);

  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
};

const escapeText = (value) =>
  String(value)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

// RFC 5545 §3.1: lines longer than 75 octets are folded with CRLF + space.
const foldLine = (line) => {
  const bytes = Buffer.from(line, 'utf8');

  if (bytes.length <= 75) {
    return line;
  }

  const parts = [];
  let current = '';
  let currentBytes = 0;

  Array.from(line).forEach((char) => {
    const charBytes = Buffer.byteLength(char, 'utf8');
    const limit = parts.length === 0 ? 75 : 74;

    if (currentBytes + charBytes > limit) {
      parts.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  });

  parts.push(current);

  return parts.join('\r\n ');
};

const property = (name, value) =>
  value === null || value === undefined ? null : `${name}:${value}`;

module.exports = {
  sync: true,

  inputs: {
    name: {
      type: 'string',
      required: true,
    },
    cards: {
      type: 'ref',
      required: true,
    },
    labelsByCardId: {
      type: 'ref',
      required: true,
    },
    listById: {
      type: 'ref',
      required: true,
    },
    boardById: {
      type: 'ref',
      required: true,
    },
    mode: {
      type: 'string',
      isIn: ['todos', 'events'],
      defaultsTo: 'todos',
    },
  },

  fn(inputs) {
    const { baseUrl } = sails.config.custom;
    const { host } = new URL(baseUrl);
    const now = toUtcStamp(new Date());

    const uidOf = (cardId) => `card-${cardId}@${host}`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Bowe//PLANKA Bowe//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(inputs.name)}`,
    ];

    inputs.cards.forEach((card) => {
      const list = inputs.listById[card.listId];
      const board = inputs.boardById[card.boardId];
      const labels = inputs.labelsByCardId[card.id] || [];

      const common = [
        property('UID', uidOf(card.id)),
        property('DTSTAMP', now),
        property('CREATED', card.createdAt && toUtcStamp(card.createdAt)),
        property('LAST-MODIFIED', toUtcStamp(card.updatedAt || card.createdAt || new Date())),
        property('SUMMARY', escapeText(card.name)),
        property('DESCRIPTION', card.description ? escapeText(card.description) : null),
        property('URL', `${baseUrl}/cards/${card.id}`),
        property('CATEGORIES', labels.length > 0 ? labels.map(escapeText).join(',') : null),
        property('X-PLANKA-BOARD', board ? escapeText(board.name) : null),
        property('X-PLANKA-LIST', list && list.name ? escapeText(list.name) : null),
      ];

      if (inputs.mode === 'events') {
        if (!card.dueDate) {
          return;
        }

        lines.push(
          'BEGIN:VEVENT',
          ...common,
          `DTSTART;VALUE=DATE:${toDateOnly(card.dueDate)}`,
          `DTEND;VALUE=DATE:${toDateOnly(card.dueDate, 1)}`,
          'TRANSP:TRANSPARENT',
          property('STATUS', card.isClosed ? 'CANCELLED' : 'CONFIRMED'),
          property('RRULE', card.recurrenceRule),
          'END:VEVENT',
        );

        return;
      }

      lines.push(
        'BEGIN:VTODO',
        ...common,
        // RFC 5545: a recurring VTODO needs DTSTART; use the due date as the anchor
        property('DTSTART', card.recurrenceRule && card.dueDate ? toUtcStamp(card.dueDate) : null),
        property('DUE', card.dueDate && toUtcStamp(card.dueDate)),
        property('STATUS', card.isClosed ? 'COMPLETED' : 'NEEDS-ACTION'),
        property('COMPLETED', card.isClosed ? toUtcStamp(card.updatedAt || new Date()) : null),
        property('PERCENT-COMPLETE', card.isClosed ? 100 : 0),
        property('PRIORITY', PRIORITY_BY_CARD_PRIORITY[card.priority]),
        property('RRULE', card.dueDate ? card.recurrenceRule : null),
        card.parentCardId ? `RELATED-TO;RELTYPE=PARENT:${uidOf(card.parentCardId)}` : null,
        'END:VTODO',
      );
    });

    lines.push('END:VCALENDAR');

    return `${lines
      .filter((line) => line !== null)
      .map(foldLine)
      .join('\r\n')}\r\n`;
  },
};
