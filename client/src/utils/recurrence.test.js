import {
  RECURRENCE_PRESETS,
  describeRecurrence,
  isValidRecurrenceRule,
  nextOccurrence,
  normalizeRecurrenceRule,
  parseRecurrenceRule,
} from './recurrence';

describe('normalizeRecurrenceRule', () => {
  test('trims whitespace, strips a leading RRULE: prefix and upper-cases the rest', () => {
    expect(normalizeRecurrenceRule('  rrule:freq=daily  ')).toBe('FREQ=DAILY');
    expect(normalizeRecurrenceRule('FREQ=weekly;interval=2')).toBe('FREQ=WEEKLY;INTERVAL=2');
  });
});

describe('parseRecurrenceRule / isValidRecurrenceRule', () => {
  test('returns null/false for empty input', () => {
    expect(parseRecurrenceRule('')).toBeNull();
    expect(parseRecurrenceRule(null)).toBeNull();
    expect(parseRecurrenceRule(undefined)).toBeNull();
    expect(isValidRecurrenceRule('')).toBe(false);
  });

  test('returns null/false for garbage input instead of throwing', () => {
    expect(() => parseRecurrenceRule('not a rule at all')).not.toThrow();
    expect(parseRecurrenceRule('not a rule at all')).toBeNull();
    expect(isValidRecurrenceRule('not a rule at all')).toBe(false);
  });

  test('returns null/false for a string with no FREQ', () => {
    expect(parseRecurrenceRule('BYDAY=MO')).toBeNull();
  });

  test('parses a valid RRULE string into an RRule instance', () => {
    const rrule = parseRecurrenceRule('FREQ=DAILY');

    expect(rrule).not.toBeNull();
    expect(rrule.options.freq).toBeDefined();
    expect(isValidRecurrenceRule('FREQ=DAILY')).toBe(true);
  });

  test('accepts a leading RRULE: prefix and mixed case', () => {
    expect(isValidRecurrenceRule('rrule:freq=weekly')).toBe(true);
  });
});

describe('describeRecurrence', () => {
  test('describes each of the built-in presets in words', () => {
    const expected = {
      daily: 'Every day',
      weekdays: 'Every weekday',
      weekly: 'Every week',
      biweekly: 'Every 2 weeks',
      monthly: 'Every month',
      yearly: 'Every year',
    };

    RECURRENCE_PRESETS.forEach((preset) => {
      expect(describeRecurrence(preset.rule)).toBe(expected[preset.key]);
    });
  });

  test('capitalizes the first letter of the description', () => {
    const text = describeRecurrence('FREQ=WEEKLY');
    expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
  });

  test('falls back to the raw value for input that cannot be parsed', () => {
    expect(describeRecurrence('not a rule')).toBe('not a rule');
  });

  test('falls back to an empty string for empty input', () => {
    expect(describeRecurrence('')).toBe('');
    expect(describeRecurrence(null)).toBe('');
  });
});

describe('nextOccurrence', () => {
  test('returns null when the rule is invalid', () => {
    expect(nextOccurrence('not a rule', new Date('2026-09-08T09:00:00Z'))).toBeNull();
    expect(nextOccurrence('', new Date())).toBeNull();
  });

  test('computes the next daily occurrence, preserving the time of day', () => {
    const after = new Date('2026-09-08T15:30:00Z');
    const next = nextOccurrence('FREQ=DAILY', after);

    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBe(new Date('2026-09-09T15:30:00Z').getTime());
  });

  test('computes the next weekly occurrence a week later', () => {
    const after = new Date('2026-09-08T09:00:00Z'); // Tuesday
    const next = nextOccurrence('FREQ=WEEKLY', after);

    expect(next.getTime()).toBe(new Date('2026-09-15T09:00:00Z').getTime());
  });

  test('computes the next weekday occurrence, skipping the weekend', () => {
    // 2026-09-11 is a Friday.
    const after = new Date('2026-09-11T09:00:00Z');
    const next = nextOccurrence('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', after);

    expect(next.getTime()).toBe(new Date('2026-09-14T09:00:00Z').getTime()); // Monday
  });

  test('is strictly after the given date, never equal to it', () => {
    const after = new Date('2026-09-08T09:00:00Z');
    const next = nextOccurrence('FREQ=DAILY', after);

    expect(next.getTime()).toBeGreaterThan(after.getTime());
  });

  test('defaults to now when no `after` date is given', () => {
    const before = Date.now();
    const next = nextOccurrence('FREQ=DAILY');
    const after = Date.now();

    expect(next.getTime()).toBeGreaterThanOrEqual(before);
    expect(next.getTime()).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 1000);
  });
});
