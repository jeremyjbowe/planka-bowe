# dtp-tasks-mcp

An [MCP](https://modelcontextprotocol.io) server that lets Claude read and run
**DTP Tasks** — the self-hosted Planka fork in this repository — through its REST
API. It speaks stdio, so it works with Claude Code, Claude Desktop, and anything
else that speaks MCP.

Everything it does goes through the ordinary `/api` endpoints as a normal user
account, so the usual Planka permissions apply. Nothing talks to the database
directly.

## What it exposes

### Reading

| Tool | What it does |
| --- | --- |
| `list_projects` | The whole project tree (projects nest), each node with its boards. Start here when you do not know a board id. |
| `get_board` | One board in full: lists (with type), labels, members, and a summary of every card. |
| `find_cards` | Search one board, or every readable board, by text, status, priority, assignee, label and due window. Sorted overdue first. |
| `get_card` | One card in detail: description, location, due, priority, colour, labels, assignees, checklists, subtasks, last 10 comments, goal links, recurrence. |
| `overview` | A short digest (< 4 KB) of overdue / due today / due this week / urgent work grouped by project › board, plus goals and their progress. |

### Writing

| Tool | What it does |
| --- | --- |
| `create_card` | New card at the bottom of a list. Labels are matched by name and created when missing; assignees are given by username. |
| `update_card` | Change name, description, due date, priority, colour, recurrence; move between lists or boards. `null` clears a field. |
| `complete_card` / `reopen_card` | Mark done / undo, exactly as the UI does (see "How done works"). |
| `create_subtask` | A child card under a parent card, on the same board and list. |
| `add_comment` | Comment on a card as the bot account. |
| `add_checklist_item` / `toggle_checklist_item` | Append to a card's checklist and tick items off. |
| `delete_card` | **Permanent.** Marked destructive so the model confirms first. Prefer `complete_card`. |

### Structure

| Tool | What it does |
| --- | --- |
| `create_project` | New shared project, optionally nested under a parent. |
| `create_board` | New board in a project. |
| `create_list` | New column; `type: "closed"` makes it the Done column. |
| `create_label` | New board label. |

### Goals (OKRs)

| Tool | What it does |
| --- | --- |
| `list_goals` | Goal tree with computed progress. |
| `get_goal` | One goal: links, children, progress, owner. |
| `create_goal` / `update_goal` | Create and edit goals. |
| `link_goal_to_card` / `link_goal_to_board` | Attach progress sources. |
| `unlink_goal` | Detach a link, by link id or by goal + target. |

## Conventions the tools follow

- **Ids are strings.** Planka ids are 64-bit snowflakes (`"1859683989615281167"`).
  They are never parsed as numbers.
- **People are usernames.** `jeremy`, `donna` — never user ids.
- **Dates are ISO 8601.** A plain `2026-09-15`, or `today` / `tomorrow`, is also
  accepted and stored at midday local time so it still reads as that date.
- Responses are compact JSON with the noise (timestamps, internal ids) stripped.

## How "done" works

This fork models completion as the card's `isClosed` flag, and the UI sets it by
moving a card into a list whose `type` is `closed`. `complete_card` does both —
it closes the card *and* moves it to the board's Done list when the board has
one — so a card completed through Claude looks identical to one dragged across
by hand. `reopen_card` is the mirror image and puts the card back on the list it
came from.

Two consequences worth knowing:

- Completing a card that has a `recurrenceRule` automatically spawns the next
  occurrence, exactly as it does in the UI.
- Subtasks are ordinary cards with a `parentCardId`, so they have their own due
  dates, priorities and assignees, and they are completed the same way.

## Configuration

Credentials live outside the repository, in a file the server reads at startup:

- `$DTP_TASKS_MCP_ENV` if that variable is set, otherwise
- `~/.config/dtp-tasks-mcp/.env`

Real environment variables always win over the file. Format:

```ini
PLANKA_BASE_URL=http://localhost:3010

# Preferred: an API key for the bot account.
PLANKA_API_KEY=<key>

# Or, instead of the key, a username and password.
PLANKA_USERNAME=<bot username>
PLANKA_PASSWORD=<bot password>
```

Give it **either** `PLANKA_API_KEY` **or** the username/password pair. Keep the
file at mode `600`; no secret is ever written to logs or tool output.

### API key vs password

An API key is the better credential for a bot:

- it is sent as an `X-Api-Key` header, so it never touches the login endpoint
  (which is rate limited);
- it is revocable on its own, without changing the account password;
- it is **not** subject to the instance's end-user terms gate, which blocks
  password login for any account that has not accepted the terms in the UI.

An admin mints one with `POST /api/users/<userId>/api-key`; the key comes back
in `included.apiKey` and is shown only once.

With a password the server logs in once per process and caches the bearer token
in memory (Planka tokens last a year), re-authenticating only after a 401.

## Access requirements for the bot account

Planka checks reads and writes differently, and **being an admin is not enough
to write**:

| Operation | What the account needs |
| --- | --- |
| `GET /api/projects` | Admin sees every *shared* project (one with no owning project manager). |
| `GET /api/boards/:id` | Admin can read any board in a shared project. |
| Creating/updating/deleting cards, comments, checklists, card labels, assignees | A **board membership with the `editor` role** on that specific board. Admin role and project-manager role do *not* substitute for it. |
| Adding a board membership | Must be a **project manager** of that board's project. |

So a bot that should manage cards needs, per board, an `editor` board
membership. In the UI: open the board → Members → add the bot user.

Projects created *through this server* are created as `shared` and the bot
becomes one of their managers automatically, so it can then add itself to boards
it creates. **Projects and boards Jeremy creates in the UI need "Donna
(assistant)" added as a board member (editor) before Claude can change anything
on them** — read-only access will already work, and writes will fail with a
"Card not found" style error, which is how Planka reports "no rights" here.

## Registering it

### Claude Code (user scope)

```sh
claude mcp add --scope user dtp-tasks -- node "/Users/donna/Developer/Planka/mcp-server/src/index.js"
```

Then check it:

```sh
claude mcp list
```

If the env file is not at the default path, add `--env DTP_TASKS_MCP_ENV=/path/to/.env`.

### Claude Desktop

Add an entry to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "dtp-tasks": {
      "command": "node",
      "args": [
        "/Users/donna/Developer/Planka/mcp-server/src/index.js"
      ],
      "env": {
        "DTP_TASKS_MCP_ENV": "/Users/donna/.config/dtp-tasks-mcp/.env"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

## Development

```sh
npm install
npm start          # runs the server on stdio (it will just sit there waiting)
npm run smoke      # end-to-end test against the live instance
```

### Smoke test

`test/smoke.mjs` spawns the server with the real MCP SDK client and walks the
whole lifecycle: list tools → `list_projects` → `get_board` → `create_card` →
`update_card` (including a list move and a recurrence round-trip) →
`add_comment` → `create_subtask` → checklist add/toggle → `complete_card` →
`find_cards(status: done)` → `get_card` → `reopen_card` → `overview` →
`list_goals`, and finally deletes every card it created — including when a check
fails.

It uses whatever account the env file points at, and needs that account to have
an `editor` membership on the board it picks. Pin the board with
`SMOKE_BOARD_ID` if the first one returned is not writable:

```sh
SMOKE_BOARD_ID=1859683989615281167 npm run smoke
```

It creates only cards named `MCP smoke test*` and removes them again, so it is
safe to run against the live instance.
