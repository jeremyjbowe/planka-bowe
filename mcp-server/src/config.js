/**
 * Configuration loading for the Planka Bowe MCP server.
 *
 * Precedence: real process env wins, then the env file. The env file is
 * whatever `PLANKA_BOWE_MCP_ENV` points at, falling back to
 * `~/.config/planka-bowe-mcp/.env`.
 *
 * Recognised keys:
 *   PLANKA_BASE_URL  - e.g. http://localhost:3010 (required)
 *   PLANKA_API_KEY   - preferred: a Planka API key, sent as the X-Api-Key
 *                      header. Skips the login endpoint entirely.
 *   PLANKA_USERNAME  - fallback: bot username (or email)
 *   PLANKA_PASSWORD  - fallback: bot password
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import dotenv from 'dotenv';

const KEYS = ['PLANKA_BASE_URL', 'PLANKA_API_KEY', 'PLANKA_USERNAME', 'PLANKA_PASSWORD'];

export function resolveEnvFilePath() {
  if (process.env.PLANKA_BOWE_MCP_ENV) {
    return process.env.PLANKA_BOWE_MCP_ENV;
  }

  return path.join(os.homedir(), '.config', 'planka-bowe-mcp', '.env');
}

export function loadConfig() {
  const envFilePath = resolveEnvFilePath();

  let fromFile = {};
  if (fs.existsSync(envFilePath)) {
    try {
      fromFile = dotenv.parse(fs.readFileSync(envFilePath));
    } catch (error) {
      throw new Error(`Could not read env file ${envFilePath}: ${error.message}`);
    }
  }

  const merged = {};
  for (const key of KEYS) {
    // A real environment variable always beats the file.
    merged[key] = process.env[key] ?? fromFile[key] ?? undefined;
  }

  const baseUrl = (merged.PLANKA_BASE_URL || '').replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error(
      `PLANKA_BASE_URL is not set. Put it in ${envFilePath} or in the environment.`,
    );
  }

  const apiKey = merged.PLANKA_API_KEY || null;
  const username = merged.PLANKA_USERNAME || null;
  const password = merged.PLANKA_PASSWORD || null;

  if (!apiKey && !(username && password)) {
    throw new Error(
      `No credentials found. Set PLANKA_API_KEY, or both PLANKA_USERNAME and ` +
        `PLANKA_PASSWORD, in ${envFilePath} or in the environment.`,
    );
  }

  return { baseUrl, apiKey, username, password, envFilePath };
}
