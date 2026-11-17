# voyagerota-core

Backend of VoyagerOTA, a free hosted over-the-air firmware update service for ESP32 boards.
Sibling repos: `voyagerota-web` (landing, docs and dashboard sites) and `VoyagerOTAClient`
(the ESP32 library, 6.0.0).

## Working rules (from the maintainer, always apply)

- Branches: work on a new branch made from `unstable`, never commit straight to `main`.
  Merge into `unstable` only when asked. Production deploys `unstable`.
- When a plan is asked for, present it and wait for "GO" before writing code.
- Build on existing code, don't delete or rewrite the original code unless asked.
  Respect reverts: if the maintainer reverted something, don't bring it back.
- Comments: short, plain, ending in `....`, only where the why isn't obvious.
  No JSDoc or doc comments, no comment walls.
- Never edit `README.md` unless asked.
- Commits: author `mediocre9`. Core and SDK commits end with
  `Co-Authored-By: Claude <noreply@anthropic.com>`. Never add Claude-Session lines.
- Never commit secrets, `.env*` files with values, `dump.rdb`, test files in
  `storage/` or `storage/trash`, or any auth bypass or test stub.
- ESP32 only. No ESP8266 work.
- Run `npx tsc --noEmit -p .`, `npx eslint src` and prettier on changed files before committing.

## Stack

Express 5 + TypeScript (run with `tsx`, no build step), tsyringe DI, Sequelize on MariaDB,
Redis (ioredis), BullMQ queues, Clerk for dashboard auth, Brevo for email, Cloudflare R2 for
firmware. Path aliases: `@config @dal @models @services @controllers @middlewares @routes
@queues @utils @schemas`.

Tables are created by `db.sync()` plus an additive column sync in `src/models/index.ts`
(adds missing columns, never drops or renames). There are no migrations.

## Processes

| Entry | What | npm |
|---|---|---|
| `src/server.ts` | API on :8080 | `dev`, `start:api` |
| `src/workers.ts` | artifact inspection, email and storage workers, outbox relay | `dev:workers`, `start:workers` |
| `src/crons.ts` | dormant, purge, orphan, service alert crons | `dev:crons`, `start:crons` |

The old one-process-per-worker npm scripts still exist for local use. Production runs the
three entries with `node --import tsx` (no `tsx` CLI, it adds a 56 MB parent process).

## API

- Dashboard: `/api/v1/workspace/...`, Clerk bearer token, `requireUser` then
  `loadOwnedProject` (404 for "missing" and "not yours").
- Devices: `/internal/api/v2/...`. Register with the project key (`x-project-id`,
  `x-api-key`), everything else with a per-device token (`Authorization: Bearer vdt_...`).
- Public: `/health`, `POST /api/v1/keep` (signed keep link from emails).
- `CORS_ORIGIN` limits browser calls to the dashboard origin.

## Product rules

- Free service, one set of limits in `src/config/limits.ts`: 3 projects per account,
  5 devices per project, 40 releases per project, 25 updates of history per device.
  A reached limit throws `LimitError` (409 with `limit`). There are no paid plans.
- Active device = approved and seen in the last 30 days (or never seen yet).
  Waiting devices are capped per project at the device limit.
- A board belongs to one project per account: approving it in another project moves it.
- Fair use: one check-in per device every 30 s (5 s in development), 300 requests a
  minute per project, answered with 429 and Retry-After.
- Releases move forward only (semver), one unfinished release at a time.
  Draft, staging (after inspection passes), production, revoked.
- Inspection: the binary must contain the production build marker and
  `VYGR_FW_VERSION:x.y.z;` matching the release.
- Promotion gate: at least one staging device reported success, plus the typed version
  (or force). Test results reset when the binary changes.
- Revoke rolls devices back to the previous production release (`isRollback`).
- Failure alerts: dashboard always, email once per release, optional auto-revoke.
- Deleted projects can be restored for 30 days, then the purge removes them.
  Restoring a project whose name was taken renames it "name (restored)".
- Dormant cleanup: idle projects get notices by email with a signed keep link,
  production projects are never touched. `DORMANT_DRY_RUN=true` only logs.

## Storage

`STORAGE_DRIVER=local` (default, `./storage`) or `r2`. With r2 an upload lands in `./storage`
first (hashed and checked), then moves to the bucket. Devices still download through the
API, which streams from R2, so the ESP32 never talks to R2. `npm run storage:migrate` copies
local files to the bucket. Wrong R2 settings fail fast with a clear message.

## Deploying

Everything for the droplet is in `deploy/` and explained in `deploy/DEPLOY.md`:
`setup.sh` once, `deploy.sh` for every deploy (health check, automatic rollback, puts the
code back if a step fails), `backup.sh` nightly to R2, `restore.sh`.
Layout: `voyagerota.com` landing, `docs.` docs, `app.` dashboard, `api.` this API.
Server paths: `/opt/voyagerota/core`, `/opt/voyagerota/web`, `/var/www/voyagerota/current`,
user `voyager`, services `voyager-api`, `voyager-workers`, `voyager-crons`.
Production settings template: `deploy/env.production.example`.

## Gotchas learned the hard way

- `db.sync()` won't change an existing column, add new ones only.
- Sequelize models are paranoid (soft delete): pass `paranoid: false` to see deleted rows,
  and `force: true` to really delete. Outbox rows block purging a project until processed.
- The purge must delete outbox rows and releases before the project (foreign keys).
- Keep link deadlines are whole seconds, the database drops milliseconds.
- BullMQ needs Redis with `maxmemory-policy noeviction`.
- The dev cron expression `*/180 * * * * *` fires every minute, not every 3 minutes, and the
  orphan cron deletes unrecorded files in `./storage` older than a minute in development.
- Shell scripts must keep LF line endings (`.gitattributes` enforces it), Windows checkouts
  broke `setup.sh` once.
- In a test, delete only the test file you created in `src/scripts/`, never the folder,
  `migrate.storage.ts` and `backup.storage.ts` live there.
