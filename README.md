# Velio group bookings

Do things with your friends, and with the people who might become friends. Book a spot on a kayak trip or a supper club, bring the people you love, and meet the ones who showed up because they love it too. Hosts list activities with a few spots each, everyone sees the spots go in real time, and the friends you invite claim their spot from their phone.

There's a backend, a web app and a Flutter app, all talking to the same API.

- `PLANS.md`: the scope questions and the technical, product and tracking plans.
- `OWNERSHIP.md`: what I'd do with the next 30 days of invites.
- `API.md`: the HTTP contract every screen is built on.

## Demo

[![Watch the 2:42 demo on YouTube](docs/demo-poster.jpg)](https://youtu.be/pAcVZyqBh-g)

**[Watch on YouTube](https://youtu.be/pAcVZyqBh-g)** (2:42) or [download it](docs/demo.mp4) (8 MB). A host lists an activity, a booker books it and vouches for a friend, the friend claims on their phone while the host watches, and two people go for the last spot at the same moment.

| | |
| --- | --- |
| ![Two people book the last spot at once: one is going, the other sees it went a second before](docs/screenshots/race.jpg) | ![The guest claims on the phone while the host's attendance updates live](docs/screenshots/live-claim.jpg) |
| **The last spot.** One person gets it, the other is told it just went, and every open screen shows it full. | **A vouch claimed.** Sam claims on the phone and shows up in Ada's group on the host's page, no refresh. |
| <img src="docs/screenshots/phone-invite.jpg" alt="A vouch invite on the phone" width="260"> | ![Feature health: every goal against its target](docs/screenshots/feature-health.jpg) |
| **The invite.** Who vouched, whose plan you'd join, and how many spots are left. | **Feature health.** Every goal from the scope against its target, at `/admin`. |

## Quick start

You need Docker, Node 22 (`nvm use` in `backend/` and `web/`) and Flutter 3.24 or newer.

1. **Database and cache**

   ```sh
   docker compose up -d
   ```

   Postgres 16 on port 5432 (user, password and database are all `velio`) and Redis 7 on 6379.

2. **Backend**

   ```sh
   cd backend
   cp .env.example .env
   npm install
   npm run db:migrate
   npm run seed
   npm run dev
   ```

   The API runs on `http://localhost:4000`. The seed wipes the dev database and loads twenty activities in eleven cities, each with its own time zone, currency and three photos. Sunset Kayaking in Lisbon already has three groups on it, a couple of activities are full, and one is in the holdout.

3. **Web**

   ```sh
   cd web
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Open `http://localhost:3000`.

4. **Mobile**

   ```sh
   cd mobile
   flutter pub get
   flutter run
   ```

   The iOS simulator finds the backend on `localhost:4000` and the Android emulator on `10.0.2.2:4000`. For a real phone, add `--dart-define=API_BASE_URL=http://<your-ip>:4000`. To open an invite on Android: `adb shell am start -a android.intent.action.VIEW -d velio://i/AX7K29QM`.

There's no sign-in. Use the "Viewing as" picker on the web, or the avatar at the top of the phone app, to switch between people.

### Tests

```sh
cd backend
npm test
```

They run against the real Postgres and Redis, in their own `velio_test` database and Redis database 1, so they never touch your dev data.

### Codes to try

| What | Code |
| --- | --- |
| A vouch from Ada to Dami | `AX7K-29QM`, claim with `dami@example.com` |
| A vouch nobody has opened | `BG5K-2YNP`, claim with `+1 415 555 0133` |
| Ada's public link | `M2QW-7HTA` |
| Kemi's host link | `H7PD-3KXA` |
| A vouch on a full activity | `SY8H-4QMD` (Pottery Night) |
| An expired vouch | `QR4T-82NP` (Board Game Night) |

Sunrise Hike is the holdout activity, so it has no invites. Dates are set relative to the day you seed.

## How it holds up

The scope sets three technical targets. I measured them with a k6 load test on one laptop: 12 activities with 40 spots each, 601 people booking at 150 a second, and a listener on every activity's live stream.

| Target | Goal | Result |
| --- | --- | --- |
| Never oversell | 0 | 0 oversold across 2,251 attempts for 480 spots |
| Bookings succeed when spots exist | 99.5% | 100% (480 booked, 1,771 correctly told it was full, 0 errors) |
| Updates feel live | p95 under 2 s | p95 14 ms from booking to every open screen |

Two of these are measured a little differently from the scope, and `PLANS.md` explains why. Sold-out answers don't count as failures, since they're the system working. Latency is timed with the booker and the listener on the same machine, because the server can't see when a phone redraws. What this doesn't cover: a real mobile network, a cold start, or more than one API process.

To run it yourself, you need `k6` (`brew install k6`):

```sh
cd backend
npm run load:seed     # builds a separate velio_load database
DATABASE_URL=postgresql://velio:velio@localhost:5432/velio_load PORT=4001 REDIS_CHANNEL_PREFIX=load \
  RATE_LIMIT_ENABLED=false PG_POOL_MAX=40 LOG_LEVEL=warn npm start

cd ../load-test && rm -rf out
node listen.mjs 75 &
k6 run -e RATE=150 -e DURATION=15s --log-output=file=out/k6.log --log-format=raw book.js
node report.mjs       # prints the table above
```

Rate limiting is off for the run because every request comes from one machine.

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

One backend serves both apps, split into modules under `backend/src/modules`. Postgres holds everything that matters. Redis only carries live updates and rate-limit counters, which we can afford to lose.

- **No overselling.** Booking a spot is a single conditional update, `UPDATE activities SET spots_taken = spots_taken + 1 … WHERE spots_taken + 1 <= capacity`, in the same transaction as the booking. When two people go for the last spot, Postgres makes the second update wait, then re-checks the condition, so it changes nothing and that person gets `409 SOLD_OUT`. A check constraint, a unique index on confirmed bookings and idempotency keys back it up. Booking, claiming and cancelling all go through the same code.
- **Live availability.** After a booking commits, the API publishes the new count to Redis. Each API process listens once and pushes the update to every open Server-Sent Events stream for that activity. A heartbeat every 15 seconds carries the latest version, so a client that missed an update catches up.
- **Invites.** A vouch can be claimed once, and only by the person it was sent to. Their phone or email is stored only as an HMAC. A public link can be claimed by anyone until the activity is full. Invites and the record of who invited whom are append-only, enforced by database triggers.
- **Feature flag.** Whether an activity gets invites is decided by hashing its id. One in ten activities is held out from day one, so we can measure what invites actually change. A single row turns invites off everywhere.

The schema lives in `backend/prisma`. The constraints and triggers are hand-written SQL in the first migration.

## Plan vs. reality

Everything in both tiers of `PLANS.md` got built, in that order. The full list of changes is in the Deviations table at the end of `PLANS.md`. The ones worth knowing:

- **Seat holds aren't built.** The plan said a vouch shouldn't hold a spot unless the data showed it should. The data did: in the scenario, 43% of invite opens land on a full activity. Holding a spot is now the first change in `OWNERSHIP.md`.
- **The API grew.** The screens needed more than the plan's 16 endpoints, such as host attendance, editing an activity, photos and the admin flags. There are now 21 error codes instead of 8, mostly for invites and photos. It's all in `API.md`.
- **A public link is only created the first time someone copies or shares it**, so "bookers who invite" counts people who meant to, not everyone who saw the button.
- **Invites start switched on for every activity** outside the holdout, so the demo works straight after a clone. In real life they'd ramp up gradually.
- **The phone doesn't poll when the live stream drops.** It keeps what it has, reconnects, and catches up on the next heartbeat. The web app polls as planned.
- **Time zones on the phone come from a built-in list** of 25 zones with their daylight saving rules, not a full time zone database. The host can only pick from that list, so nothing shows the wrong time.
- **The people picker isn't in the design.** It's there because there's no sign-in.

## Trade-offs

I spent the time in this order: the booking path and the test that proves it, live updates, invites with a history that can't be rewritten, every screen in the design, then the scenario and the load test. The plans came first, before any code.

Shortcuts I took, and what each would need:

- **No real sign-in.** The picker sends a user id in a header. The natural fix is a one-time code sent to the guest's phone or email when they claim, and only one file reads identity, so the change is contained.
- **The admin pages are open to anyone.** They'd need auth before anything else.
- **A vouch trusts the contact the guest types.** It stops a forwarded link from working, but not someone who knows the recipient's email. The one-time code fixes that too.
- **Photos are stored on the server's disk.** Production would upload straight to object storage and check the file itself, not just its declared type.
- **A crash right after a booking can lose that one live update.** The heartbeat corrects it within 15 seconds. An outbox table would remove the gap.
- **Every booking on an activity updates the same row.** That's fine at these sizes: the load test saw 21 ms at 150 bookings a second. An activity with hundreds of bookings a second would need one row per spot.
- **Rate limits are per IP address**, which would hurt people behind a shared office network.
- **The 30-day scenario is made up.** It proves the queries work, not how people behave.
- **"Tell me if a spot opens" saves the request but sends nothing yet.** It's what a waitlist would read.
- **The phone can't edit photos after an activity is published.** The web can.

For production, in order: sign-in and locked-down admin pages, photo uploads to storage, alerts on the metrics that already exist, the outbox, a proper time zone database on the phone, and push notifications.

## Where to see the tracking

- **`/admin`** in the web app shows every goal from the scope against its target. The same report is at `http://localhost:4000/admin/health`. Add `?minSample=0` to see triggers on small demo data.
- **`http://localhost:4000/metrics`** has Prometheus counters for bookings, sold-out answers, errors and invite claims, split by web and mobile, plus the live-update latency.
- **SQL views** in Postgres answer each goal directly: `bookers_invite_rate`, `invite_claim_rate`, `invite_opens`, `invite_funnel`, `k_factor_by_rail`, `plan_sizes`, `guest_return_30d`, `holdout_comparison`, `holdout_summary`, `oversell_check` and `booking_success_rate`.

### The 30-day scenario

`OWNERSHIP.md` is written from a simulated month of data. To load it and print the queries behind it:

```sh
cd backend
npm run seed:scenario    # loads velio_scenario
npm run diagnostics      # add --sql to see the queries
```

To see it in `/admin`, set `SCENARIO_DATABASE_URL` in `backend/.env` and pick the scenario in the data menu.

To ask "what if the numbers were different", rerun it with a knob. Each run takes about five seconds:

```sh
SCENARIO_VOUCH_CLAIM_X=0.36 npm run seed:scenario   # vouches convert like public links
SCENARIO_OPEN_DELAY_DAYS=1 npm run seed:scenario    # friends open invites within a day
SCENARIO_INVITE_SHARE=0.17 npm run seed:scenario    # half as many bookers invite
```

The other knobs are `SCENARIO_LINK_CLAIM_X`, `SCENARIO_DEMAND_X` and `SCENARIO_MOBILE_SHARE`. Run it with none set to get back to the numbers in `OWNERSHIP.md`.
