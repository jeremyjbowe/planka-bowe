#!/usr/bin/env node
/**
 * dtp-tasks-mcp - an MCP server that lets Claude operate DTP Tasks, the
 * self-hosted Planka fork, through its REST API.
 *
 * Transport is stdio, so stdout belongs to the MCP protocol alone: every
 * diagnostic goes to stderr.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { PlankaClient } from './planka-client.js';
import { register as registerStructure } from './tools/structure.js';
import { register as registerCards } from './tools/cards.js';
import { register as registerChecklists } from './tools/checklists.js';
import { register as registerGoals } from './tools/goals.js';
import { register as registerOverview } from './tools/overview.js';

const log = (message) => {
  process.stderr.write(`[dtp-tasks-mcp] ${message}\n`);
};

async function main() {
  const config = loadConfig();

  const client = new PlankaClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    username: config.username,
    password: config.password,
    log,
  });

  const server = new McpServer(
    { name: 'dtp-tasks', version: '1.0.0' },
    {
      instructions:
        'DTP Tasks is a self-hosted Planka board. Work top-down: list_projects to find a ' +
        'board, get_board or find_cards to see what is on it, get_card for detail. People are ' +
        'always named by username. Ids are opaque strings. "Done" means the card is closed - ' +
        'use complete_card and reopen_card rather than moving cards by hand. delete_card is ' +
        'permanent, so confirm with the user first.',
    },
  );

  const context = { client, config };

  registerStructure(server, context);
  registerCards(server, context);
  registerChecklists(server, context);
  registerGoals(server, context);
  registerOverview(server, context);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log(
    `ready - ${config.baseUrl} (auth: ${config.apiKey ? 'API key' : `password for ${config.username}`})`,
  );
}

main().catch((error) => {
  log(`fatal: ${error?.message || error}`);
  process.exit(1);
});
