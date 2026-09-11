/*!
 * planka-bowe — Saved views.
 *
 * A saved view is a named preset of a board's view mode plus its filter
 * state (`data`). Personal views (`is_shared = false`) are only visible to
 * their creator; shared ones to everybody on the board. No DB-level foreign
 * keys, like the rest of the schema.
 */

module.exports.up = (knex) =>
  knex.schema.createTable('saved_view', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('board_id').notNullable();
    table.bigInteger('creator_user_id');

    table.text('name').notNullable();
    table.boolean('is_shared').notNullable().defaultTo(false);
    table.jsonb('data').notNullable();
    table.specificType('position', 'double precision').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.index('board_id');
    table.index('creator_user_id');
  });

module.exports.down = (knex) => knex.schema.dropTable('saved_view');
