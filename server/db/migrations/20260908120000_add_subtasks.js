/*!
 * planka-bowe — subtasks.
 *
 * A subtask is a full card that points at its parent card. Planka keeps
 * referential integrity in application code (there are no DB-level foreign
 * keys, see db/clean-orphaned-records.js), so this is a plain indexed column.
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.bigInteger('parent_card_id');
    table.index('parent_card_id');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.dropColumn('parent_card_id');
  });
