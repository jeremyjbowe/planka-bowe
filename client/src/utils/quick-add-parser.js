/*!
 * planka-bowe — Quick Add parser.
 *
 * Turns a sentence such as
 *   "Fix invoice bug @jeremy #billing !high tomorrow 3pm"
 * into card fields. Tokens are resolved against the data the caller passes in
 * (board members, board labels, the user's projects); anything that cannot be
 * resolved is reported in `unresolved` so the UI can show it.
 *
 * Dates use chrono-node with forward dating, so "friday" means the next one.
 */

import * as chrono from 'chrono-node';

import { CardPriorities } from '../constants/Enums';

const PRIORITY_ALIASES = {
  low: CardPriorities.LOW,
  l: CardPriorities.LOW,
  medium: CardPriorities.MEDIUM,
  med: CardPriorities.MEDIUM,
  m: CardPriorities.MEDIUM,
  normal: CardPriorities.MEDIUM,
  high: CardPriorities.HIGH,
  h: CardPriorities.HIGH,
  urgent: CardPriorities.URGENT,
  u: CardPriorities.URGENT,
  critical: CardPriorities.URGENT,
  p0: CardPriorities.URGENT,
  p1: CardPriorities.HIGH,
  p2: CardPriorities.MEDIUM,
  p3: CardPriorities.LOW,
};

// Matches @user, #label, !priority and ~project tokens. Tokens may be quoted
// to contain spaces: #"needs review".
const TOKEN_REGEX = /(^|\s)([@#!~])(?:"([^"]+)"|([^\s@#!~]+))/g;

const normalize = (value) => value.trim().toLowerCase();

const findByName = (items, value, keys) => {
  const needle = normalize(value);

  return (
    items.find((item) => keys.some((key) => item[key] && normalize(item[key]) === needle)) ||
    items.find((item) => keys.some((key) => item[key] && normalize(item[key]).startsWith(needle)))
  );
};

const collapseWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

export const parseQuickAdd = (input, { users = [], labels = [], projects = [], now } = {}) => {
  const result = {
    name: '',
    userIds: [],
    labelIds: [],
    priority: null,
    projectId: null,
    dueDate: null,
    dueDateText: null,
    unresolved: [],
    tokens: [],
  };

  if (!input) {
    return result;
  }

  let remainder = input.replace(TOKEN_REGEX, (match, leading, sigil, quoted, bare) => {
    const value = quoted || bare;

    result.tokens.push({ sigil, value });

    switch (sigil) {
      case '@': {
        const user = findByName(users, value, ['username', 'name']);

        if (user) {
          if (!result.userIds.includes(user.id)) {
            result.userIds.push(user.id);
          }
        } else {
          result.unresolved.push(`@${value}`);
        }

        break;
      }
      case '#': {
        const label = findByName(labels, value, ['name']);

        if (label) {
          if (!result.labelIds.includes(label.id)) {
            result.labelIds.push(label.id);
          }
        } else {
          result.unresolved.push(`#${value}`);
        }

        break;
      }
      case '!': {
        const priority = PRIORITY_ALIASES[normalize(value)];

        if (priority) {
          result.priority = priority;
        } else {
          result.unresolved.push(`!${value}`);
        }

        break;
      }
      case '~': {
        const project = findByName(projects, value, ['name']);

        if (project) {
          result.projectId = project.id;
        } else {
          result.unresolved.push(`~${value}`);
        }

        break;
      }
      default:
    }

    return leading;
  });

  const [dateMatch] = chrono.parse(remainder, now || new Date(), { forwardDate: true });

  if (dateMatch) {
    let dueDate = dateMatch.start.date();

    // "tomorrow" without a time lands on the start of the working day, not
    // on the current wall-clock time.
    if (!dateMatch.start.isCertain('hour')) {
      dueDate = new Date(dueDate);
      dueDate.setHours(9, 0, 0, 0);
    }

    result.dueDate = dueDate;
    result.dueDateText = dateMatch.text;

    remainder = `${remainder.slice(0, dateMatch.index)} ${remainder.slice(
      dateMatch.index + dateMatch.text.length,
    )}`;
  }

  result.name = collapseWhitespace(remainder);

  return result;
};

export default parseQuickAdd;
