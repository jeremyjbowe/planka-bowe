/*!
 * planka-bowe — recurring cards.
 *
 * `recurrence_rule` holds an RFC 5545 RRULE (e.g. FREQ=WEEKLY;BYDAY=MO).
 * `recurrence_spawned_at` is set exactly once when the next occurrence has
 * been created from a completed card; the spawner claims it atomically so
 * repeated triggers can never create duplicates.
 */

module.exports.up = async (knex) => {
  await knex.schema.alterTable('card', (table) => {
    table.text('recurrence_rule');
    table.timestamp('recurrence_spawned_at', true);
  });

  return knex.schema.raw(
    'CREATE INDEX card_recurrence_pending_index ON card (id) WHERE recurrence_rule IS NOT NULL AND is_closed AND recurrence_spawned_at IS NULL',
  );
};

module.exports.down = async (knex) => {
  await knex.schema.raw('DROP INDEX IF EXISTS card_recurrence_pending_index');

  return knex.schema.alterTable('card', (table) => {
    table.dropColumn('recurrence_rule');
    table.dropColumn('recurrence_spawned_at');
  });
};
