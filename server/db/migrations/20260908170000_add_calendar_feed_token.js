/*!
 * planka-bowe — calendar feeds. A per-user secret that authenticates read-only
 * iCalendar feed URLs (personal and per-board), so calendar apps can
 * subscribe without a session.
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('user_account', (table) => {
    table.text('calendar_feed_token');
    table.unique('calendar_feed_token');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('user_account', (table) => {
    table.dropColumn('calendar_feed_token');
  });
