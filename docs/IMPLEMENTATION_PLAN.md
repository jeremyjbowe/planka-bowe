# Implementation plan — DTP fork of Planka

This document is the working plan for evolving Planka 2.2.x into a premium
project & goals tracker. It is written for humans *and* for future AI sessions:
every section names the exact files that own a concern.

## 0. Ground rules

- Keep the real-time Kanban core. Every new view reads from the same
  redux-orm store (`client/src/models`, `client/src/selectors`) and therefore
  inherits live updates from the existing socket watchers
  (`client/src/sagas/core/watchers/socket.js`). No duplicated state.
- PostgreSQL stays the source of truth. Every schema change is a Knex
  migration in `server/db/migrations` plus a Sails model attribute in
  `server/api/models`, a query-method entry in
  `server/api/hooks/query-methods/models`, and controller input validation.
- Server → client flow for any new card field:
  `server/api/controllers/cards/update.js` (input) →
  `server/api/helpers/cards/update-one.js` (business rules + socket broadcast)
  → `client/src/api/cards.js` (transform) → `client/src/models/Card.js`
  (fields + `CARD_UPDATE` / `CARD_UPDATE_HANDLE` reducers).
- UI dispatches only `entry-actions/*`; sagas in `sagas/core/services/*` call
  the API and dispatch `actions/*` for the ORM reducers.
- Commit after every completed must-have feature. Verify the dev stack still
  runs and two browser tabs still sync before moving on.

## 1. Current architecture (verified 2026-09-08)

| Concern | Where |
|---|---|
| Board views (kanban / grid / list already exist) | `client/src/constants/Enums.js#BoardViews`, `components/boards/Board/{KanbanContent,FiniteContent,EndlessContent}.jsx`, view switch in `components/boards/BoardActions/RightSide/RightSide.jsx`, view is a client-only field seeded from `board.defaultView` |
| Card data | `client/src/models/Card.js`; server `server/api/models/Card.js` |
| Card completion | `card.isClosed`, derived when a card moves into a list whose type maps to `ListTypeStates.CLOSED` (`sagas/core/services/cards.js#updateCard`, mirrored server-side in `helpers/cards/update-one.js`) |
| Checklists | `TaskList` (per card) → `Task` rows (`task_list`, `task` tables). Untouched by this fork. |
| Filtering | `models/Board.js#getFilteredCardsModelArray`, `models/List.js#getFilteredCardsModelArray`, UI in `components/boards/BoardActions/Filters.jsx` |
| Shell / chrome | `components/common/Fixed/Fixed.jsx` (header, favorites strip, board tab strip), `components/common/Static/Static.jsx` (content area), geometry in `Static.module.scss`. No sidebar exists. |
| Styling | CSS modules per component, global `client/src/styles.module.scss`, vendored Semantic UI 2.4 in `client/src/lib/custom-ui/styles.css`. No theme system, no dark mode; the app is hard-coded dark grey (`#22252a`). |
| Keyboard | `components/boards/Board/ShortcutsProvider.jsx` (hover-target shortcuts). No command palette. |
| Background jobs | Only `server/api/hooks/watcher` (a `setInterval` hook). New jobs follow the same hook pattern. |

## 2. Schema decisions

### 2.1 Subtasks vs. checklists

Checklists (`task_list` / `task`) stay byte-for-byte as they are: lightweight
checkbox rows owned by a card.

Subtasks are real cards. One new nullable self-reference on `card`:

```
card.parent_card_id  bigint NULL REFERENCES card(id) ON DELETE SET NULL, indexed
```

- A subtask lives in a list like any card, has its own members, labels,
  due date, priority and checklists, and appears in Kanban/Table/Timeline.
- The parent shows a "Subtasks" section in the card modal and a progress
  line on the card face ("2/5") computed **client-side** from the ORM:
  `children = Card.filter({ parentCardId })`, `done = children.filter(isClosed)`.
  Because children are ordinary cards, socket `cardUpdate` events already keep
  the bar live.
- Completion signal is `card.isClosed`. The fork additionally allows
  `isClosed` to be set directly through `PATCH /api/cards/:id` (editor role),
  so a subtask can be ticked off without dragging it to a "Done" list. Moving
  a card between lists keeps deriving `isClosed` exactly as upstream does.
- Cycle guard on the server: a card cannot be its own ancestor; parent must be
  on the same board (v1 constraint, keeps the board payload self-contained).
- Deleting a parent detaches its children (`SET NULL`) instead of deleting
  work.

### 2.2 Hierarchical projects (not boards)

```
project.parent_project_id  bigint NULL REFERENCES project(id) ON DELETE SET NULL, indexed
```

- Boards stay flat inside a project. Projects can nest to any depth; the
  sidebar renders the tree, boards of a sub-project are only visible when the
  parent is expanded.
- Server guards: no cycles; a project can only be parented to a project the
  actor manages.
- Visibility is unchanged: `GET /api/projects` still returns exactly the
  projects the user may see; the client builds the tree from
  `parentProjectId` and treats an invisible parent as a root.

### 2.3 Priority (needed by Quick Add `!priority`)

```
card.priority  text NULL  -- 'low' | 'medium' | 'high' | 'urgent'
```

Shown as a small chip on the card face, a sortable Table column and a Quick
Add token.

### 2.4 Recurrence

```
card.recurrence_rule        text NULL       -- RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=MO
card.recurrence_spawned_at  timestamp NULL  -- set once the next occurrence has been created
```

- When a recurring card becomes `isClosed = true`, the next occurrence is
  created: same name, description, type, labels, members, priority,
  recurrence rule, checklists (unchecked), placed at the top of the board's
  first active list, `dueDate` = `rrule.after(previousDueDate ?? now)`.
- Idempotency: the spawner claims the card with a single atomic
  `UPDATE card SET recurrence_spawned_at = now() WHERE id = $1 AND
  recurrence_spawned_at IS NULL RETURNING *`. Zero rows → someone else already
  spawned → skip. This makes repeated triggers (the interval job and the
  inline trigger after close) safe.
- Reopening a card after it spawned does nothing; reopening before the spawn
  ran simply un-qualifies it (`is_closed = false`).
- Implementation: `server/api/hooks/recurrence` (interval job, 60 s) plus an
  inline call at the end of `helpers/cards/update-one.js` so the UI feels
  instant. Rule parsing via the `rrule` package on both sides.

### 2.5 New board views

`BoardViews` gains `TABLE` (`'table'`) and `TIMELINE` (`'timeline'`) on the
client and `Board.Views` on the server (no DB constraint exists on
`board.default_view`, only application-level validation).

## 3. Feature plan (must-haves, in order)

1. **Table view** — `@tanstack/react-table` component at
   `components/boards/Board/TableView/`. Rows come from
   `selectors.selectFilteredCardIdsForCurrentBoard` and the per-card
   selectors. Columns: title, list, members, labels, due date, priority,
   subtask progress, created. Column sorting is TanStack state; row click
   opens the card modal.
2. **Timeline view** — `frappe-gantt` wrapped in
   `components/boards/Board/TimelineView/`. Bars for cards with a due date
   (start = `createdAt` or `dueDate - 1 day`, end = `dueDate`). `on_date_change`
   dispatches `entryActions.updateCard(id, { dueDate })`, which persists via the
   existing saga → API → Postgres path.
3. **Subtasks** — migration, model fields, `Subtasks` section in the card
   modal (add existing card as child / create child inline), progress bar on
   the card face, "Parent" breadcrumb on the child.
4. **Recurring tasks** — migration, `EditRecurrenceStep` popup (presets +
   custom RRULE), server spawner hook.
5. **Hierarchical projects** — migration, "Parent project" selector in project
   settings, new persistent left sidebar (`components/common/Sidebar/`)
   rendering the tree, collapsible, remembers expansion in localStorage.
6. **Quick Add + command palette** — `components/common/CommandPalette/`
   mounted in `Core.jsx`, `Cmd/Ctrl+K`. Parser in `utils/quick-add-parser.js`
   (chrono-node for dates; `@user`, `#label`, `!priority`, `~project` tokens
   resolved against the ORM). Search is client-side over ORM data; a backend
   search endpoint is explicitly deferred and will be flagged if needed.
7. **Theme** — design tokens in `client/src/styles/theme.css`
   (`:root` = dark, `[data-theme="light"]` = light, system preference by
   default, user override stored locally). New components use tokens from the
   start; this step re-skins the existing shell, cards, lists, modals, popups
   and the vendored Semantic UI surfaces.
8. **Empty states + onboarding** — `components/common/EmptyState/`, a
   first-run `OnboardingModal` that creates a project + board + three lists in
   one click, and empty-state art for boards, lists, table and timeline.

## 4. Verification checklist per feature

- `npm run lint` in `client/` and `server/`.
- Dev stack boots (`npm start` at repo root, or the two launch configs).
- Two browser tabs on the same board: an edit in one appears in the other
  without refresh.
- The feature's acceptance test from the brief passes in the browser.
