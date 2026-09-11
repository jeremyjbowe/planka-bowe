/*!
 * planka-bowe — card priority (low / medium / high / urgent), used by Quick Add's
 * `!priority` token, the Table view and the card chips.
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.text('priority');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.dropColumn('priority');
  });
