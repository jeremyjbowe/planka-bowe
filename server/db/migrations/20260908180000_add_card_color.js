/*!
 * planka-bowe — card color accent (a fixed palette of 10 soft colors), used to
 * tint the card face and the card modal header.
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.text('color');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('card', (table) => {
    table.dropColumn('color');
  });
