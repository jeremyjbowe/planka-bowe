# PLANKA — DTP edition

A premium, self-hosted project & goals tracker built on top of
[Planka](https://github.com/plankanban/planka) 2.2. Everything Planka does
(real-time Kanban, markdown cards, checklists, time tracking, attachments,
comments, OIDC, notifications) still works; on top of it this fork adds the
views, structure and polish of modern tools.

> This is a downstream fork maintained by DTP. It is not intended as a pull
> request to upstream. Upstream's license (see `LICENSE.md`) applies.

## What's new

| Area | Feature |
|---|---|
| Views | **Table view** (TanStack Table) with sortable Title, List, Members, Labels, Due date, Priority, Subtasks and Created columns. Sorting is remembered per board. |
| Views | **Timeline view** (frappe-gantt): cards with a due date are bars; drag a bar or its edge to reschedule. Unscheduled cards sit in a side panel. Day / Week / Month zoom. |
| Structure | **Subtasks**: a card can have a parent card. Subtasks are full cards (own list, members, labels, due date, checklists) and show as a live progress line ("2/5") on the parent. Checklists are unchanged. |
| Structure | **Hierarchical projects**: projects can nest inside projects. A collapsible sidebar renders the tree; a sub-project's boards only appear when its parent is expanded. |
| Automation | **Recurring cards** (RFC 5545 RRULE): completing a recurring card creates the next occurrence with the same fields and the next due date. Duplicate-safe by design (atomic claim + interval job as a safety net). |
| Speed | **Quick Add / command palette** (`Cmd/Ctrl + K`): create cards from a sentence — `Fix invoice bug @jeremy #billing !high tomorrow` — and jump to any project, board or card. Client-side search over the data already in the browser. |
| Fields | **Priority** (low / medium / high / urgent) on cards, with chips, an editor and a Table column. |
| Look | **Soft dark theme by default, light theme on request or by OS preference.** Design tokens, Inter, refined focus rings, custom scrollbars, hover lifts, drag ghosts, glass modals. |
| First run | **Empty states everywhere and a 30-second onboarding** that creates a project, a board and template lists in one click. |
| Calendar | **iCalendar feeds** (VTODO or all-day VEVENT): a secret per-user subscribe URL for "my cards" and one per board, with due dates, completion, priority, labels as categories, recurrence rules and parent relations. Works with Thunderbird, Tasks.org, Nextcloud Tasks (tasks) and Apple/Google Calendar (events). |
| Outcomes | **Goals / OKRs**: global goals that nest, link to cards and boards, and compute progress live from linked card completion (manual override when nothing is linked). Goals page in the sidebar, goal chips on cards. |

All views read from the same normalized redux-orm store, so anything that
changes anywhere (including by another user over the socket) updates live in
every view without extra requests.

## Quick start (Docker, production)

Requirements: Docker with Compose v2.

```bash
git clone <this repository> planka && cd planka
# 1. Set a real secret (required)
sed -i.bak "s/SECRET_KEY=notsecretkey/SECRET_KEY=$(openssl rand -hex 32)/" docker-compose.yml
# 2. Set the URL your users will open
sed -i.bak "s#BASE_URL=http://localhost:3000#BASE_URL=https://tasks.example.com#" docker-compose.yml
# 3. Build the fork image and start everything (app + PostgreSQL)
docker compose up -d --build
```

Open the app on port 3000 (or your reverse-proxied URL). The first admin is
created from the `DEFAULT_ADMIN_*` variables in `docker-compose.yml`
(uncomment them before the first start), or with

```bash
docker compose exec planka npm run db:create-admin-user
```

Database migrations run automatically on start (`start.sh` runs
`db:upgrade`). Data lives in the `db-data` and `data` volumes. Back up with
`./docker-backup.sh`, restore with `./docker-restore.sh` (unchanged from
upstream).

The image is built from this repository (`build: .` in `docker-compose.yml`),
so the fork's features are what you get; `docker compose build` again after
pulling changes.

## Local development

Requirements: Node 22+ (24 recommended, matches the Docker image), Python 3
(used by the server's `postinstall` for the notification providers), Docker
for PostgreSQL or a local PostgreSQL 16.

```bash
# PostgreSQL
docker run -d --name planka-pg -e POSTGRES_DB=planka \
  -e POSTGRES_HOST_AUTH_METHOD=trust -p 5432:5432 postgres:16-alpine

# Dependencies for root, server and client
npm install

# Server environment
cp server/.env.sample server/.env
# uncomment DEFAULT_ADMIN_* in server/.env to get a first admin (demo/demo)

# Migrate + seed, then start both dev servers
npm run server:db:init
npm start            # server on :1337, client (Vite) on :3000
```

Useful extras:

- `node scripts/seed-demo-data.mjs` fills a running instance with a demo
  project, board, labels, members and cards (uses the demo admin).
- `npm run lint` runs ESLint for both packages (the pre-commit hook does too).
- `docker compose -f docker-compose-dev.yml up` is upstream's all-in-Docker
  dev setup and still works.

## Using the new features

- **Switch views** with the icons at the right of the board header:
  Kanban, Grid, List, Table, Timeline. Board settings → Preferences sets the
  default view per board.
- **Subtasks**: open a card → *Subtasks* section → *Add subtask* (creates a
  child card in the same list) or *Link existing card*. Tick a subtask to
  complete it. The sidebar action *Parent card* makes the current card a
  subtask of another; a breadcrumb above the title leads back to the parent.
- **Recurring cards**: open a card → *Repeat* → pick a preset or type an
  RRULE (`FREQ=WEEKLY;BYDAY=MO,WE`). When the card is completed (moved to a
  closed list or ticked off), the next occurrence is created at the top of
  the board's first active list.
- **Priority**: open a card → *Priority*, or use `!high` in Quick Add.
- **Sub-projects**: Project settings → *Parent project*. You need to manage
  both projects. Projects appear as a tree in the sidebar.
- **Quick Add**: press `Cmd/Ctrl + K` anywhere (or click the search box in
  the header). Tokens: `@user` (name or username of a board member),
  `#label` (board label), `!low|medium|high|urgent` (or `p0`–`p3`),
  `~project` (creates in that project's first board), and natural dates
  such as `tomorrow`, `next friday 3pm`, `in 2 weeks`. Without tokens the
  same box searches projects, boards and cards.
- **Theme**: bottom of the sidebar or user menu → *Theme* cycles
  System / Light / Dark.
- **Calendar feeds**: user menu → *Settings* → *Calendar* for the personal
  feed (every card you are a member of), or a board's *⋮* menu → *Calendar
  feed* for that board. Pick *Tasks (VTODO)* for task apps or *Events* for
  calendar apps that ignore tasks, copy the subscribe URL (or open it as
  `webcal://`), or download the `.ics`. The link carries a secret token tied
  to your account; *Reset link* invalidates it. Feeds are read-only; a
  two-way CalDAV server is not part of v1.
- **Goals**: sidebar → *Goals*. Admins and project owners create goals;
  the owner (or an admin) edits them. Open a goal to set status, target
  date, parent goal and description, and use *Link to goal* to attach
  boards (progress = closed cards / cards on the board) or cards (done or
  not). From a card, the *Goal* action links that card to any goal. Progress
  is the average over linked cards, linked boards and sub-goals; a goal with
  nothing linked shows a manual slider instead. Goals marked *Done* count as
  100%.

## Customizing the accent color and theme

Everything visual reads CSS custom properties from
`client/src/styles/theme.css`.

- **Accent**: change the three values at the top of `:root` —
  `--accent-h`, `--accent-s`, `--accent-l` (HSL). Every accent shade
  (hover, strong, soft backgrounds, focus ring) is derived from them. For a
  teal accent, for example: `--accent-h: 174; --accent-s: 62%; --accent-l: 47%;`
- **Surfaces, text, borders, status colors, shadows, radii, spacing,
  typography and motion** are all tokens in the same file. The dark palette
  lives on `:root`; the light palette overrides only what differs under
  `[data-theme='light']`.
- **Default theme**: `client/src/utils/theme.js` resolves the user's
  preference. `resolveTheme()` returns dark unless the OS asks for light;
  flip that condition if you prefer light by default.
- **Semantic UI surfaces** (buttons, inputs, dropdowns, popups, modals) are
  re-skinned from tokens in `client/src/styles/app-theme.scss`. Component
  styles use tokens via `var(--…)` in their `*.module.scss` files.

## Architecture notes for future (AI-assisted) development

Read `docs/IMPLEMENTATION_PLAN.md` first: it maps the codebase, records the
schema decisions and lists the exact files that own each concern.

Conventions that keep the codebase predictable:

- **One data path.** UI dispatches `client/src/entry-actions/*`; sagas in
  `client/src/sagas/core/services/*` call `client/src/api/*` and dispatch
  `client/src/actions/*`; redux-orm models in `client/src/models/*` reduce
  them. Socket events arrive through `sagas/core/watchers/socket.js` and go
  down the same reducers. New views must select from the ORM
  (`client/src/selectors/*`) and never keep their own copy of cards.
- **New card field checklist**: Knex migration in `server/db/migrations` →
  attribute in `server/api/models/Card.js` → input validation in
  `server/api/controllers/cards/{create,update}.js` → business rules in
  `server/api/helpers/cards/update-one.js` → `client/src/models/Card.js`
  field → UI. `priority` and `recurrenceRule` are complete examples.
- **Goals** are a global entity: `server/api/{models,controllers,helpers}/goal*`,
  loaded with the core bootstrap (`sagas/core/requests/core.js` →
  `goalsBundle`), reduced by `client/src/models/{Goal,GoalLink}.js`, and
  computed by `client/src/selectors/goals.js#computeProgress`. Socket events:
  `goalCreate/Update/Delete`, `goalLinkCreate/Update/Delete`; link summaries
  go through `helpers/goal-links/broadcast-target-update.js` per user.
- **Calendar feeds**: `server/api/helpers/calendar-feeds/build-ics.js` is the
  serializer (RFC 5545 escaping and 75-octet folding); controllers in
  `server/api/controllers/calendar-feeds`; public routes are whitelisted in
  `server/config/policies.js` and authenticated by `user_account.calendar_feed_token`,
  which the user presenter never returns. Client UI:
  `client/src/components/common/CalendarFeedLinks`.
- **Self references** (`card.parent_card_id`, `project.parent_project_id`)
  are plain indexed columns, like every reference in Planka (there are no
  DB-level foreign keys; `db/clean-orphaned-records.js` exists for that
  reason). Cycle guards live in the controllers.
- **Background jobs** are Sails hooks with an interval
  (`server/api/hooks/recurrence`, modelled on `hooks/watcher`). Make them
  idempotent with a conditional `UPDATE … RETURNING` claim, as the
  recurrence spawner does, so inline triggers and the interval can coexist.
- **Sagas that `call` other sagas** must not leave forks behind:
  `createBoard`/`createCard` cancel their watcher forks before returning
  (see the commit history for why).
- **i18n**: add keys to `client/src/locales/en-US/core.js` under `common`
  or `action`; other locales fall back to English.
- **Lint before committing**; the Husky pre-commit hook rejects unused
  `eslint-disable` directives.

### Deliberate v1 decisions and known limits

- Command-palette search is client-side over the data already loaded:
  projects and boards are always complete, cards cover the boards visited in
  this session. A server search endpoint was deliberately not added; add one
  (and flag it) only if real data volume makes the client-side filter slow.
- Timeline bars span the due date's day (Planka cards have no start date).
- Recurrence creates the next occurrence when a card closes; reopening and
  re-closing the same card does not spawn again.
- `~project` in Quick Add creates in the project's first board and fetches
  that board's lists on demand if they are not loaded.
- Goal progress for a board that is not loaded in the browser uses the
  totals the server sent at startup, refreshed whenever a card on that board
  changes; a loaded board is computed live from the store. Names and totals
  of linked items are only sent to users who can see that board.
- Calendar sync is one-way (export feeds). Feeds are served from
  `/feeds/:token/...` on the API host without a session, so `BASE_URL` must
  be the public address; calendar apps typically refresh every 15–60 min.
- Not yet built from the high-value list: keyboard-first navigation overlay,
  cover image accents, saved views, JSON export/import.

## Upstream documentation

Configuration variables, OIDC, S3 storage, SMTP, Apprise notifications and
the REST API are unchanged; see the upstream docs at
<https://docs.planka.cloud>.
