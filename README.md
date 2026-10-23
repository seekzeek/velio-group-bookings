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

## SLOs and the load test

The scope sets three technical targets. `PLANS.md` tightens two of them: success rate leaves out correct sold-out rejections, and end-to-end latency is measured with the booking client and the listening client on the same machine, because the server can't see a phone render.

| SLO | Target | Measured | Met |
| --- | --- | --- | --- |
| Never oversell | 0, ever | 0 oversold after 2,251 attempts on 480 spots (`oversell_check` view) | yes |
| Bookings succeed when spots exist | 99.5% | 100% (480 ok, 0 errors, 1,771 correct sold-out rejections) | yes |
| Availability feels live | p95 under 2 s to every open client | p95 14 ms end to end (p50 6 ms, max 34 ms); server side, commit to SSE write, p95 under 5 ms | yes |

Two runs on one laptop (Apple Silicon, Postgres and Redis in Docker, API on `tsx`), 12 activities with 40 spots each and 601 bookers, one SSE listener per activity. The first run booked at 40 attempts a second for 30 seconds; the second at 150 a second for 15 seconds, so most attempts were fighting over the last spots. Booking request p95 was 16 ms and 21 ms. The numbers above are from the harder run. Rate limiting was off for the run, since every request comes from one IP; nothing else was changed.

What this does not show: a real network between phone and server, a cold connection pool, or more than one API process. The server-side histogram is what production would alert on; the end-to-end number is the one that answers the SLO as written.

To run it yourself:

```sh
# 1. a second backend on its own database, so the dev data is untouched
cd backend
npm run load:seed                       # creates velio_load, 601 bookers, 12 activities, writes load-test/fixture.json
DATABASE_URL=postgresql://velio:velio@localhost:5432/velio_load PORT=4001 REDIS_CHANNEL_PREFIX=load \
  RATE_LIMIT_ENABLED=false PG_POOL_MAX=40 LOG_LEVEL=warn npm start

# 2. in load-test/, the listener, the bookings, then the report
cd ../load-test && rm -rf out
node listen.mjs 75 &                    # one SSE stream per activity, logs every availability event with its arrival time
k6 run --log-output=file=out/k6.log --log-format=raw book.js        # RATE=150 DURATION=15s for the burst
node report.mjs
```

`book.js` gives every attempt a distinct booker and activity, so each one is a genuine first booking until the activity is full. It logs the start time and the resulting version of every successful booking; `report.mjs` joins those with the listener's arrival times and prints the table above, plus the oversell count from `/admin/health` and the server histogram from `/metrics`. Needs `k6` (`brew install k6`).

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
