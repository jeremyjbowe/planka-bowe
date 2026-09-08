/**
 * Shared registration helper: every tool gets the same error handling so a
 * failed API call comes back as a readable tool error instead of a stack trace.
 */

import { errorResult } from '../util.js';

export function defineTool(server, name, config, handler) {
  server.registerTool(name, config, async (args, extra) => {
    try {
      return await handler(args ?? {}, extra);
    } catch (error) {
      return errorResult(error);
    }
  });
}

/** Common wording reused across tool descriptions. */
export const ID_NOTE =
  'Ids are opaque numeric strings (e.g. "1859683989615281167") - always pass them as strings.';

export const DATE_NOTE =
  'Dates are ISO 8601 strings; a plain "YYYY-MM-DD" or "today"/"tomorrow" is also accepted ' +
  'and is stored at midday local time.';

export const PEOPLE_NOTE = 'People are identified by username (e.g. "jeremy"), never by id.';
