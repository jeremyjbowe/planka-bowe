/*!
 * DTP fork — Goals / OKR layer.
 *
 * `goal` is global (not owned by a project) and may nest through
 * `parent_goal_id`. `goal_link` joins a goal to a card or a board; progress
 * is computed from linked card completion, or from `progress` when a goal
 * has no links (manual override). No DB-level foreign keys, like the rest
 * of the schema.
 */

module.exports.up = async (knex) => {
  await knex.schema.createTable('goal', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('owner_user_id');
    table.bigInteger('parent_goal_id');

    table.text('name').notNullable();
    table.text('description');
    table.text('status').notNullable();
    table.timestamp('target_date', true);
    table.smallint('progress');
    table.specificType('position', 'double precision').notNullable();

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.index('owner_user_id');
    table.index('parent_goal_id');
    table.index('position');
  });

  return knex.schema.createTable('goal_link', (table) => {
    /* Columns */

    table.bigInteger('id').primary().defaultTo(knex.raw('next_id()'));

    table.bigInteger('goal_id').notNullable();
    table.bigInteger('card_id');
    table.bigInteger('board_id');

    table.timestamp('created_at', true);
    table.timestamp('updated_at', true);

    /* Indexes */

    table.index('goal_id');
    table.index('card_id');
    table.index('board_id');
    table.unique(['goal_id', 'card_id']);
    table.unique(['goal_id', 'board_id']);
  });
};

module.exports.down = async (knex) => {
  await knex.schema.dropTable('goal_link');
  return knex.schema.dropTable('goal');
};
