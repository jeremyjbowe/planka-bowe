const { expect } = require('chai');

/**
 * `build-ics` is a plain, sync Sails helper (`module.exports = { inputs, fn }`)
 * that only touches the `sails` global to read `sails.config.custom.baseUrl`.
 * It can be exercised directly via `.fn(inputs)` without lifting Sails.
 *
 * When this file runs as part of the full `npm test` run, `test/lifecycle.test.js`
 * has already lifted a real Sails app (its `before`/`after` hooks are global, not
 * scoped to that file), so `global.sails` already exists — leave it alone and read
 * the real `baseUrl` back out of it. When this file runs standalone (`npx mocha
 * .../build-ics.test.js`), no such global exists yet, so stub the minimum shape
 * the helper reads.
 */
if (!global.sails) {
  global.sails = {
    config: {
      custom: {
        baseUrl: 'https://planka.test',
      },
    },
  };
}

const buildIcs = require('../../../api/helpers/calendar-feeds/build-ics');

// Read lazily: under `npm test` the lifecycle hook replaces the stub above with
// the real Sails app (and its real `baseUrl`) after this file has been loaded.
const getBaseUrl = () => sails.config.custom.baseUrl;
const getHost = () => new URL(getBaseUrl()).host;

const LIST_BY_ID = {
  'list-1': { id: 'list-1', name: 'To Do' },
};

const BOARD_BY_ID = {
  'board-1': { id: 'board-1', name: 'Project X' },
};

const buildFeed = (cards, { mode, labelsByCardId = {} } = {}) =>
  buildIcs.fn({
    name: 'My Feed',
    cards,
    labelsByCardId,
    listById: LIST_BY_ID,
    boardById: BOARD_BY_ID,
    ...(mode ? { mode } : {}),
  });

const baseCard = (overrides = {}) => ({
  id: 'card-1',
  name: 'A card',
  description: null,
  listId: 'list-1',
  boardId: 'board-1',
  dueDate: null,
  isClosed: false,
  priority: null,
  recurrenceRule: null,
  parentCardId: null,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  ...overrides,
});

describe('calendar-feeds/build-ics', () => {
  describe('envelope', () => {
    it('starts with BEGIN:VCALENDAR and ends with END:VCALENDAR', () => {
      const output = buildFeed([baseCard()]);

      expect(output.startsWith('BEGIN:VCALENDAR\r\n')).to.equal(true);
      expect(output.endsWith('END:VCALENDAR\r\n')).to.equal(true);
    });

    it('includes the calendar name', () => {
      const output = buildFeed([baseCard()]);
      expect(output).to.include('X-WR-CALNAME:My Feed');
    });

    it('produces a bare calendar with no components for an empty card list', () => {
      const output = buildFeed([]);

      expect(output).to.equal(
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Bowe//PLANKA Bowe//EN',
          'CALSCALE:GREGORIAN',
          'METHOD:PUBLISH',
          'X-WR-CALNAME:My Feed',
          'END:VCALENDAR',
          '',
        ].join('\r\n'),
      );
    });
  });

  describe('todos mode (default)', () => {
    it('emits exactly one VTODO per card, including cards without a due date', () => {
      const cards = [
        baseCard({ id: 'card-1', dueDate: '2026-09-10T17:00:00.000Z' }),
        baseCard({ id: 'card-2', dueDate: null }),
        baseCard({ id: 'card-3', dueDate: null }),
      ];

      const output = buildFeed(cards, { mode: 'todos' });

      expect((output.match(/BEGIN:VTODO/g) || []).length).to.equal(3);
      expect((output.match(/END:VTODO/g) || []).length).to.equal(3);
      expect(output).to.not.include('BEGIN:VEVENT');
    });

    it('formats DUE and, when recurring, DTSTART as UTC timestamps', () => {
      const card = baseCard({
        id: 'card-1',
        dueDate: '2026-09-10T17:00:00.000Z',
        recurrenceRule: 'FREQ=WEEKLY',
      });

      const output = buildFeed([card], { mode: 'todos' });

      expect(output).to.include('DUE:20260910T170000Z');
      expect(output).to.include('DTSTART:20260910T170000Z');
      expect(output).to.include('RRULE:FREQ=WEEKLY');
    });

    it('omits DTSTART when the card has no recurrence rule, even with a due date', () => {
      const card = baseCard({
        id: 'card-1',
        dueDate: '2026-09-10T17:00:00.000Z',
        recurrenceRule: null,
      });

      const output = buildFeed([card], { mode: 'todos' });

      expect(output).to.include('DUE:20260910T170000Z');
      expect(output).to.not.include('DTSTART:');
    });

    it('omits DUE entirely when the card has no due date', () => {
      const output = buildFeed([baseCard({ id: 'card-1', dueDate: null })], { mode: 'todos' });

      expect(output).to.not.match(/\bDUE[:;]/);
    });

    it('marks an open card as NEEDS-ACTION with 0% complete and no COMPLETED property', () => {
      const output = buildFeed([baseCard({ id: 'card-1', isClosed: false })], { mode: 'todos' });

      expect(output).to.include('STATUS:NEEDS-ACTION');
      expect(output).to.include('PERCENT-COMPLETE:0');
      expect(output).to.not.include('COMPLETED:');
    });

    it('marks a closed card as COMPLETED with 100% complete and a COMPLETED timestamp', () => {
      const card = baseCard({
        id: 'card-1',
        isClosed: true,
        updatedAt: '2026-09-06T12:34:56.000Z',
      });

      const output = buildFeed([card], { mode: 'todos' });

      expect(output).to.include('STATUS:COMPLETED');
      expect(output).to.include('PERCENT-COMPLETE:100');
      expect(output).to.include('COMPLETED:20260906T123456Z');
    });

    it('maps card priority to an iCalendar PRIORITY value', () => {
      const output = buildFeed([baseCard({ id: 'card-1', priority: 'urgent' })], {
        mode: 'todos',
      });

      expect(output).to.include('PRIORITY:1');
    });

    it('omits PRIORITY when the card has none', () => {
      const output = buildFeed([baseCard({ id: 'card-1', priority: null })], { mode: 'todos' });

      expect(output).to.not.match(/\bPRIORITY:/);
    });

    it('links a child card to its parent via RELATED-TO', () => {
      const cards = [
        baseCard({ id: 'card-1' }),
        baseCard({ id: 'card-2', parentCardId: 'card-1' }),
      ];

      const output = buildFeed(cards, { mode: 'todos' });

      expect(output).to.include(`RELATED-TO;RELTYPE=PARENT:card-card-1@${getHost()}`);
    });

    it('builds a stable per-card UID from the card id and configured host', () => {
      const output = buildFeed([baseCard({ id: 'abc-123' })], { mode: 'todos' });

      expect(output).to.include(`UID:card-abc-123@${getHost()}`);
      expect(output).to.include(`URL:${getBaseUrl()}/cards/abc-123`);
    });

    it('serializes labels as a comma-separated CATEGORIES list', () => {
      const output = buildFeed([baseCard({ id: 'card-1' })], {
        mode: 'todos',
        labelsByCardId: { 'card-1': ['Billing', 'Urgent'] },
      });

      expect(output).to.include('CATEGORIES:Billing,Urgent');
    });
  });

  describe('events mode', () => {
    it('skips cards without a due date entirely', () => {
      const cards = [
        baseCard({ id: 'card-1', dueDate: '2026-09-10T17:00:00.000Z' }),
        baseCard({ id: 'card-2', dueDate: null }),
      ];

      const output = buildFeed(cards, { mode: 'events' });

      expect((output.match(/BEGIN:VEVENT/g) || []).length).to.equal(1);
      expect(output).to.include(`UID:card-card-1@${getHost()}`);
      expect(output).to.not.include(`UID:card-card-2@${getHost()}`);
      expect(output).to.not.include('BEGIN:VTODO');
    });

    it('renders an all-day event spanning the due date as DTSTART/DTEND VALUE=DATE', () => {
      const card = baseCard({ id: 'card-1', dueDate: '2026-09-10T17:00:00.000Z' });
      const output = buildFeed([card], { mode: 'events' });

      expect(output).to.include('DTSTART;VALUE=DATE:20260910');
      expect(output).to.include('DTEND;VALUE=DATE:20260911');
      expect(output).to.include('TRANSP:TRANSPARENT');
    });

    it('maps an open card to CONFIRMED and a closed card to CANCELLED', () => {
      const openCard = baseCard({ id: 'card-1', dueDate: '2026-09-10T17:00:00.000Z' });
      const closedCard = baseCard({
        id: 'card-2',
        dueDate: '2026-09-11T17:00:00.000Z',
        isClosed: true,
      });

      const output = buildFeed([openCard, closedCard], { mode: 'events' });

      expect(output).to.include('STATUS:CONFIRMED');
      expect(output).to.include('STATUS:CANCELLED');
    });
  });

  describe('text escaping (RFC 5545 §3.3.11)', () => {
    it('escapes commas, semicolons and newlines in SUMMARY and DESCRIPTION', () => {
      const card = baseCard({
        id: 'card-1',
        name: 'Comma, semicolon; and\nnewline',
        description: 'Desc, with; stuff\nand a newline',
      });

      const output = buildFeed([card], { mode: 'todos' });

      expect(output).to.include('SUMMARY:Comma\\, semicolon\\; and\\nnewline');
      expect(output).to.include('DESCRIPTION:Desc\\, with\\; stuff\\nand a newline');
    });

    it('escapes a literal backslash', () => {
      const card = baseCard({ id: 'card-1', name: 'Path\\to\\thing' });
      const output = buildFeed([card], { mode: 'todos' });

      expect(output).to.include('SUMMARY:Path\\\\to\\\\thing');
    });

    it('omits DESCRIPTION entirely when the card has none', () => {
      const output = buildFeed([baseCard({ id: 'card-1', description: null })], {
        mode: 'todos',
      });

      expect(output).to.not.match(/\bDESCRIPTION:/);
    });
  });

  describe('line folding (RFC 5545 §3.1)', () => {
    it('folds a SUMMARY line longer than 75 octets with a CRLF + space continuation', () => {
      const longName = 'A'.repeat(90);
      const card = baseCard({ id: 'card-1', name: longName });

      const output = buildFeed([card], { mode: 'todos' });
      const lines = output.split('\r\n');

      const summaryLineIndex = lines.findIndex((line) => line.startsWith('SUMMARY:'));
      expect(summaryLineIndex).to.be.greaterThan(-1);

      // The physical SUMMARY line itself must respect the 75-octet cap...
      expect(Buffer.byteLength(lines[summaryLineIndex], 'utf8')).to.be.at.most(75);

      // ...and the next physical line is the folded continuation (starts with a space).
      const continuation = lines[summaryLineIndex + 1];
      expect(continuation.startsWith(' ')).to.equal(true);

      // Unfolding (drop CRLF + leading space) reconstructs the original content.
      const unfolded = `${lines[summaryLineIndex]}${continuation.slice(1)}`;
      expect(unfolded).to.equal(`SUMMARY:${longName}`);
    });

    it('does not fold short lines', () => {
      const output = buildFeed([baseCard({ id: 'card-1', name: 'Short title' })], {
        mode: 'todos',
      });

      const lines = output.split('\r\n');
      expect(lines.some((line) => line.startsWith('SUMMARY:'))).to.equal(true);
      expect(lines.some((line) => line === ' Short title')).to.equal(false);
    });
  });
});
