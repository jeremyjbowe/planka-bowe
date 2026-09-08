# Vision checklist — DTP fork of Planka

The original brief, condensed into checkable items. The autonomous loop
re-reads this file, marks what is verifiably done in the repo, and works on
the first unchecked item. Update the boxes when a feature lands (with the
commit hash) so the loop never repeats finished work.

## Must-have (acceptance tests in the brief)

- [x] Table view on the shared redux-orm store, sortable columns, live updates — `44f42d9`
- [x] Timeline / Gantt view, drag edge persists due date — `b8a916d`
- [x] Subtasks as child cards (parent_card_id) with live progress, checklists untouched — `5d9316c`
- [x] Recurring cards (RRULE) with duplicate-safe background spawner — `e8b3c23`
- [x] Hierarchical projects (parent_project_id) rendered as a sidebar tree — `8ca4f49`
- [x] Quick Add with natural-language dates, @ # ! ~ tokens, Cmd/Ctrl+K palette — `1f87f61`
- [x] Soft dark theme by default + light mode from system preference — `807f831`
- [x] Empty states + 30-second onboarding — `2f39d7d`

## High-value (in the brief's order)

- [x] Goals / OKR layer linked to cards and boards (model confirmed by Jeremy) — `c9b9368`
- [x] CalDAV / VTODO sync as iCalendar feeds (export, v1) — `bd46b29`
- [x] Keyboard-first navigation (j/k, h/l, shortcuts overlay `?`) — see commit `feat: keyboard-first navigation`
- [x] Card cover images + soft color accents — see commit `feat: card color accents`
- [ ] Improved filtering and saved views
- [x] Export/import of boards as JSON — see commit `feat: board JSON export/import`

## UI/UX requirements (non-negotiable) — verify, not just build

- [x] Deep charcoal backgrounds (#0f0f12 / #16161a), elevated cards, subtle borders, soft shadows
- [x] Accent color system changeable in one place (`client/src/styles/theme.css`)
- [x] Inter typography with hierarchy
- [x] Micro-interactions: drag ghost, hover lifts, animated progress bars, press scale
- [x] 8px spacing scale, focus rings, custom scrollbars
- [x] Glassmorphism on command palette and onboarding/goal overlays
- [ ] Responsive audit: sidebar, board header, Table/Timeline, modals at 375px / 768px widths
- [ ] Desktop polish audit: every screen in both themes, no leftover upstream light-theme surfaces

## Technical / delivery

- [x] Minimal disruption to Redux + Sails architecture; new views read the same store
- [x] Background jobs added cleanly (recurrence hook)
- [x] Self-hostable: `docker-compose.yml` builds the fork image; README setup instructions
- [x] README: setup, new features, accent/theme customization, notes for AI-assisted development
- [ ] Docker image build verified on a machine with registry access (blocked here: registry unreachable)
- [ ] Final pass: lint both packages, client + server test suites, two-tab real-time check after the last feature
