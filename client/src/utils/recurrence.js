/*!
 * DTP fork — recurrence helpers shared by the card modal, card face and
 * Quick Add. Rules are RFC 5545 RRULE strings; the server validates them too.
 */

import { RRule } from 'rrule';

export const RECURRENCE_PRESETS = [
  { key: 'daily', rule: 'FREQ=DAILY', labelKey: 'common.recurrenceDaily' },
  {
    key: 'weekdays',
    rule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    labelKey: 'common.recurrenceWeekdays',
  },
  { key: 'weekly', rule: 'FREQ=WEEKLY', labelKey: 'common.recurrenceWeekly' },
  { key: 'biweekly', rule: 'FREQ=WEEKLY;INTERVAL=2', labelKey: 'common.recurrenceBiweekly' },
  { key: 'monthly', rule: 'FREQ=MONTHLY', labelKey: 'common.recurrenceMonthly' },
  { key: 'yearly', rule: 'FREQ=YEARLY', labelKey: 'common.recurrenceYearly' },
];

export const normalizeRecurrenceRule = (value) =>
  value
    .trim()
    .replace(/^RRULE:/i, '')
    .toUpperCase();

export const parseRecurrenceRule = (value) => {
  if (!value) {
    return null;
  }

  try {
    const options = RRule.parseString(normalizeRecurrenceRule(value));

    if (options.freq === undefined) {
      return null;
    }

    return new RRule(options);
  } catch {
    return null;
  }
};

export const isValidRecurrenceRule = (value) => !!parseRecurrenceRule(value);

// Human readable text such as "every week" or "every 2 weeks on Monday".
export const describeRecurrence = (value) => {
  const rrule = parseRecurrenceRule(value);

  if (!rrule) {
    return value || '';
  }

  const text = rrule.toText();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// Next occurrence strictly after `after`, keeping that date's time of day.
export const nextOccurrence = (value, after) => {
  const rrule = parseRecurrenceRule(value);

  if (!rrule) {
    return null;
  }

  const base = after || new Date();
  return new RRule({ ...rrule.origOptions, dtstart: base }).after(base, false);
};
