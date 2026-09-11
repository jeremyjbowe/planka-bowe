/*!
 * planka-bowe — hierarchical projects.
 *
 * Projects can contain sub-projects (boards stay flat inside a project).
 * Referential integrity is application-level, matching the rest of the
 * schema, so this is a plain indexed column.
 */

module.exports.up = (knex) =>
  knex.schema.alterTable('project', (table) => {
    table.bigInteger('parent_project_id');
    table.index('parent_project_id');
  });

module.exports.down = (knex) =>
  knex.schema.alterTable('project', (table) => {
    table.dropColumn('parent_project_id');
  });
