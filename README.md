# Velio group bookings

Group bookings with live availability and invites. Hosts list activities with limited spots, bookers reserve a spot and form a plan, invited guests claim a spot from their phone.

- `PLANS.md`: scope questions, technical, product and tracking plans.
- `OWNERSHIP.md`: the 30-day improvement plan.
- `API.md`: the HTTP contract every screen is built from.

## Quick start

You need Docker, Node 22 (`nvm use` picks it up from `.nvmrc`) and Flutter 3.24 or newer for the mobile app.

1. Database and cache

   ```sh
   docker compose up -d
   ```

   Postgres 16 on `localhost:5432` (user, password and database all `velio`) and Redis 7 on `localhost:6379`. `max_connections` is raised to 200 so the concurrency and load tests can open real parallel connections.

2. Backend

   ```sh
   cd backend
   cp .env.example .env
   npm install
   npm run db:migrate
   npm run seed
   npm run dev
   ```

   The API listens on `http://localhost:4000`. `npm run seed` wipes the dev database and loads the sample world: Sunset Kayaking hosted by Kemi with Ada's, Femi's and Ife's groups, the other Explore activities, two full ones, one in the holdout, and the invite codes it prints at the end.

3. Web

   ```sh
   cd web
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`.

4. Mobile

   ```sh
   cd mobile
   flutter pub get
   flutter run
   ```

   The Android emulator reaches the backend at `http://10.0.2.2:4000` automatically; the iOS simulator uses `http://localhost:4000`. For a phone on your network pass `--dart-define=API_BASE_URL=http://<your-ip>:4000`. Open an invite on the emulator with `adb shell am start -a android.intent.action.VIEW -d velio://i/AX7K29QM`.

### Tests

```sh
cd backend
npm test
```

Tests run against the real Postgres and Redis from docker compose, in their own database `velio_test` (created and migrated automatically) and Redis logical database 1. They never touch the dev database. `npm run test:setup` prepares the test database on its own.

### Useful seed data

`npm run seed` prints ids and codes. The fixed ones:

| What | Value |
| --- | --- |
| Vouch to claim (Ada to Dami) | `AX7K-29QM`, claim with `dami@example.com` |
| Vouch not opened yet (Ada to Bola) | `BG5K-2YNP`, claim with `+1 415 555 0133` |
| Ada's public link | `M2QW-7HTA` |
| Kemi's host link | `H7PD-3KXA` |
| Vouch opened when full | `SY8H-4QMD` (Pottery Night) |
| Expired vouch | `QR4T-82NP` (Board Game Night) |
| Holdout activity | Sunrise Hike (no invites, by design) |

Dates are relative to the day you seed, so the sample stays in the future.

## Architecture

```
 Web (Next.js)        Flutter
       \               /
        REST and SSE
             |
        Express API
         /        \
   PostgreSQL     Redis
```

One backend, a modular monolith in `backend/src/modules`, serves both apps over the contract in `API.md`. Postgres is the source of truth for spots and attribution. Redis carries live update messages and rate-limit counters, nothing we can't lose.

- **Concurrency.** Reserving a spot is one conditional `UPDATE activities SET spots_taken = spots_taken + 1 … WHERE spots_taken + 1 <= capacity RETURNING …` in the same transaction as the booking insert. Under READ COMMITTED a waiting update re-checks its WHERE against the committed row, so the loser updates zero rows and gets `409 SOLD_OUT`. A CHECK constraint, a partial unique index on confirmed bookings and idempotency keys back it up. Every path that changes `spots_taken` (booking, invite claim, cancellation) goes through the booking module.
- **Live availability.** After a transaction commits, the API publishes the new count and version to Redis. Each process holds one subscriber and fans out to the open Server-Sent Events connections for that activity. Clients get a snapshot on connect and a heartbeat with the current version every 15 seconds, and refetch when they notice a gap.
- **Invites and attribution.** Vouches are single-use and bound to a recipient contact that is stored only as an HMAC. Public links are multi-use. `invites`, `invite_revocations` and `attributions` are append-only, enforced by database triggers. Every claim writes an attribution row with inviter, invitee, rail, code, plan and hop generation.
- **Feature flag.** Invites are decided per activity by `hash(activity_id + salt) % 100`. Buckets 0 to 9 are the holdout from day one; the rollout only ramps through 10 to 99. A row in `feature_flags` is the kill switch.

Schema and migrations live in `backend/prisma`. The CHECK constraint, partial unique indexes and append-only triggers are hand-written SQL at the end of the first migration.

## Plan vs. reality

Written before submission.

## Trade-offs

Written before submission.

## Where to see the tracking

- `GET http://localhost:4000/metrics`: Prometheus counters for booking attempts, successes, sold-out rejections and errors, claim outcomes by rail, open SSE connections, and the commit-to-write latency histogram.
- `GET http://localhost:4000/admin/health`: every goal from the scope with its current value, target, trigger and status. Triggers only evaluate above the cohort minimums from `PLANS.md`; add `?minSample=0` to force them on demo data, and `?source=scenario` to read the 30-day scenario.
- `/admin` in the web app renders the same report.
- SQL views, created by the migrations, that you can query with `psql`: `bookers_invite_rate`, `invite_claim_rate`, `invite_opens`, `invite_funnel`, `k_factor_by_rail`, `plan_sizes`, `guest_return_30d`, `holdout_comparison`, `holdout_summary`, `oversell_check`, `booking_success_rate`.

### The 30-day scenario

```sh
cd backend
npm run seed:scenario    # creates and loads velio_scenario on the same Postgres
npm run diagnostics      # prints the diagnostic queries against it; add --sql to see the SQL
```

Then set `SCENARIO_DATABASE_URL` in `.env` (see `.env.example`) and open `/admin/health?source=scenario`. The generator is seeded, so the numbers are the same on every run: about 33% of bookers invite, about 11% of opened invites end in a claim, vouches convert far better than public links, most opens are on mobile, and about 43% of opens land on an activity that is already full.
