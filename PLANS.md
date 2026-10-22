# Plans

Group bookings with live availability and invites.

I wrote this before starting on the code. Anything I changed along the way is logged in the Deviations section at the bottom, with the reason.

A quick note on how I read the feature. A booking gets one person to an activity. What Velio actually wants is a group of friends going somewhere together, so I've treated the plan (the group) as the thing that matters and the booking as the way someone joins it. A lot of the choices below follow from that.

---

## 1a. Questions for the product owner

### 1. Does an invite hold a spot? And what is a plan, exactly?

Ada books one of the last few spots on Sunset Kayaking and invites three friends. By the time they open the link that evening, the activity is full. Nothing in the scope says what happens there, and as written, the friend just hits a sold-out page. Popular activities fill quickly and people rarely open invites straight away, so I'd expect this to happen a lot and to drag the claim rate down.

The scope also says booking puts people "in a Plan together" without saying whether that's everyone on the activity or Ada and her friends.

What I'm going with: a plan is a friend group, and an activity can have many of them. Guests claim from the same pool as everyone else for now, and the invite page shows live spots so nobody is surprised. I'm recording how many spots were left when each invite was opened. If a big share of opens land on full activities, holding a spot for vouch invites is the first thing I'd build next.

### 2. What stops someone forwarding a vouch?

The scope says a vouch means "I stand behind this person." If anyone holding the code can claim it, a vouch forwarded to a group chat is just a public link with a nicer label, and the trust data Velio wants to build on later becomes unreliable.

What I'm going with: a vouch is for one person and can be used once. It's tied to the recipient's phone or email, and they confirm it when claiming. A public link can be used by anyone until the activity fills. I only store contacts as an HMAC, after normalising them (phone numbers to international format, emails lowercased), otherwise "+234 803..." and "0803..." would never match.

### 3. I don't think "25% of opened invites" can be measured fairly as written

One public link dropped in a group chat might be opened by 300 people. A vouch is opened by one. If both go into the same rate, the number mostly tells you what mix of invites people sent, not whether invites work. People who type a code in also never "open" anything.

There's a similar problem with "30% of bookers generate an invite." Creating a link and sending it aren't the same thing, and we can't see whether a copied link was ever pasted anywhere.

What I'm going with: an open is one person or device resolving an invite, whether by link or typed code. I report every invite metric per rail. I'd push for separate targets for vouch and public because they're different behaviours, and honestly I'm not sure 25% is the right number for public links at all. For the "sent" question, I'll track created invites that were never opened as a rough stand-in.

### 4. Nothing measures whether plans actually happen

Velio's core metric is K-factor _and_ plans that happen, but only the first half is measurable from the scope. K-factor also needs a time window, and I don't think someone who already uses Velio and claims an invite should count as a new user brought in.

What I'm going with: K-factor is the number of new users who joined through invites from a cohort of bookers within 14 days, divided by the bookers in that cohort, per rail. For plans, I'm counting a plan as having happened if it still has two or more confirmed people when the activity starts. It's a proxy. Check-in at the venue would make it real, and that's on the follow-up list.

### 5. Two of the technical targets need tighter definitions

"99.5% of booking attempts on available spots succeed." If two people go for the last spot, one of them has to lose. That's the system working, so it shouldn't count against the target. I'm defining success rate as successful bookings over attempts, leaving out correct sold-out rejections. In practice that makes it one minus the error rate.

"p95 of 2 seconds to every open client." The server can't see when a phone actually renders an update, and client clocks aren't trustworthy enough to compare against server timestamps. I'll measure commit-to-SSE-write on the server in production, and do the true end-to-end measurement in a load test where the booking client and the listening client run on the same machine.

One more thing that isn't in the scope at all: cancellations. I'm building them into the model anyway. Any waitlist or refund work later needs to release spots, and I'd rather not reopen the inventory code to add that.

---

## 1b. Technical plan

### Shape of the system

```
 Web (Next.js)        Flutter
       \               /
        REST and SSE
             |
        Express API
         /        \
   PostgreSQL     Redis
```

There's one backend, and both apps go through it. That way the rules, the error codes and the events are the same on web and mobile, and a bug fixed once is fixed everywhere.

Postgres is the source of truth for spots and attribution. Redis only holds things we can afford to lose: live update messages and rate-limit counters.

I'm deliberately not using Next.js API routes. The live stream needs a long-running process holding a Redis subscription, and splitting logic between Next.js and a separate API is how you end up with three apps that happen to share a database.

### Data model

| Table                | Main columns                                                                                                          | Notes                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`              | id, display_name, contact_hmac, generation, remind_day_before, friend_updates                                         | contact_hmac is unique when present. generation is written once. The two preferences are set when a guest claims (reminders on, friend updates off)            |
| `activities`         | id, host_id, title, description, location, starts_at, timezone, price_minor, currency, capacity, spots_taken, version | check that spots_taken stays between 0 and capacity                                                                                                            |
| `plans`              | id, activity_id, owner_id                                                                                             | one friend group on one activity                                                                                                                               |
| `bookings`           | id, activity_id, plan_id, user_id, status, source, invite_id, idempotency_key, cancelled_at                           | one confirmed booking per person per activity                                                                                                                  |
| `invites`            | id, code, rail, inviter_id, activity_id, plan_id, recipient_hmac, recipient_label, expires_at                         | append-only. plan_id is empty for host invites, recipient_hmac for public links. recipient_label is the inviter's own note of who it's for, shown only to them |
| `invite_revocations` | invite_id, reason                                                                                                     | append-only                                                                                                                                                    |
| `attributions`       | id, invite_id, rail, code, inviter_id, invitee_id, invitee_was_new, hop_generation, plan_id, booking_id               | append-only, one per vouch                                                                                                                                     |
| `events`             | id, name, occurred_at, user_id, anon_id, platform, activity_id, invite_id, rail, props                                | no personal data                                                                                                                                               |
| `flag_exposures`     | user_id, activity_id, flag, variant                                                                                   | written the first time a user sees an activity with the flag checked                                                                                           |
| `activity_photos`    | id, activity_id, url, position                                                                                        | up to 6 per activity, position 0 is the cover                                                                                                                  |

The inviter's label exists because a vouch only stores an HMAC of the contact, so without it the inviter could never see who an unclaimed invite was for. It's typed by the inviter, it isn't contact data, and nobody else sees it.

Which user a new guest became is answered by the attribution row (`invitee_was_new`), not by a column on `users`. Putting it on `users` would mean creating the user, then the attribution, then going back to update the user, and generation is meant to be written once.

How plans get created:

- If you book directly, you start your own plan.
- If you claim a booker's invite, you join their plan.
- If you claim a host's invite, you start a new plan. A host is inviting you to the activity, not into somebody's group.

The "one confirmed booking per person" rule is a partial unique index on confirmed bookings only, so someone who cancels can book again later.

Prices are stored in minor units with a currency. Activities keep their own time zone, because a 6pm kayaking trip is 6pm where the kayaks are.

### Not overselling the last spot

The whole guarantee comes down to one statement, run in the same transaction as inserting the booking:

```sql
UPDATE activities
   SET spots_taken = spots_taken + 1, version = version + 1
 WHERE id = $1 AND spots_taken + 1 <= capacity
RETURNING spots_taken, capacity, version;
```

If it returns no rows, the activity is full. The transaction rolls back and the client gets `409 SOLD_OUT`.

The reason it's safe is how Postgres handles two updates to the same row. The second one waits for the first to commit or roll back, and then checks its WHERE clause again against the row as it is now, not as it was when it started waiting. So if two people go for the last spot, the second update finds `spots_taken + 1 > capacity` and changes nothing. There's no moment between reading the count and writing it where someone else can sneak in, because the read and the write are the same operation.

On top of that:

- A check constraint means the database itself won't accept an oversold row, even if I get the code wrong somewhere.
- The unique index stops one person holding two confirmed spots on the same activity.
- Every booking request carries an idempotency key, so if a phone on a bad connection retries, it gets back the original booking instead of a second one.

Booking, claiming an invite and cancelling all go through the same module. I don't want a second code path that touches `spots_taken` and forgets the guard.

Things I considered and didn't pick:

- `SELECT ... FOR UPDATE` and then an update. It's correct, but it holds the lock for two round trips to do what one statement does.
- A Redis counter as the gatekeeper. It's fast, but then Redis and Postgres can disagree about how many spots are left, and I'd rather the number that matters lives somewhere durable.
- SERIALIZABLE isolation with retries. Also correct, but at sell-out time you get lots of aborted transactions and retry loops, which is exactly when you least want them.
- Optimistic locking with a version check. Lots of requests would fail on conflict even with spots still left, which works against the 99.5% target.

The cost of this approach is that every booking for one activity waits on the same row. For activities with a few dozen spots, that's a few milliseconds and doesn't matter. If Velio ever sold thousands of spots on one activity, I'd switch to a row per spot and `FOR UPDATE SKIP LOCKED`.

How I'll prove it. The concurrency test fires 50 real parallel requests at an activity with 5 spots, 20 times over, and checks for exactly 5 successes, 45 sold-outs, no server errors, and confirmed bookings matching `spots_taken`. The database pool in the test is bigger than 50. Otherwise requests queue inside the app and never actually race, and the test passes for the wrong reason.

I'm also running the same test against a deliberately broken version that reads the count, sleeps briefly and then writes. If the test doesn't catch that one overselling, it isn't testing anything. A second test races normal bookings against invite claims for the same last spots.

### Live availability

When a booking commits, the API publishes the new count and version to a Redis channel for that activity. Every API instance has one Redis subscription and passes the message on to whichever browsers and phones have that activity open, over Server-Sent Events. Clients ignore any message with a version older than the one they already have.

Publishing happens after the commit, never inside the transaction. If it happened inside and the transaction then rolled back, everyone would have seen a count that never existed.

I picked SSE over WebSockets because updates only go one way. Booking and claiming are normal HTTP requests, so the stream only needs to push. SSE is plain HTTP, reconnects on its own and passes through proxies without special setup. If Velio wanted chat or presence inside a plan later, that's when WebSockets would make sense.

Redis pub/sub doesn't remember anything, so a few things can go wrong and I want each one covered:

- A client that drops off and reconnects has missed messages, so the server sends a fresh snapshot on every connect.
- If the server crashes between committing and publishing, that update is lost. Every 15 seconds the server sends a heartbeat with the current version, so a client that's behind notices and refetches. In production I'd use an outbox table to make publishing survive crashes.
- If the stream can't connect at all, clients fall back to refetching every 10 seconds. Slower, but still correct.
- Response compression would buffer the stream and quietly add seconds of delay, so the stream route skips it.

The stream doesn't require you to be signed in. Spot counts aren't personal, and the browser's `EventSource` can't send custom headers anyway.

On the 2 second target, the server side of it (commit, publish, deliver, write) should take well under 50ms. Nearly all of the budget is there for mobile networks.

### Invites and attribution

A vouch is for one named person and can be claimed once. A public link can be claimed by anyone until the activity fills. Each user can only vouch for a limited number of people per activity. Vouching for twenty people stops meaning much.

Claiming an invite happens in one transaction:

1. Check the code is real, not revoked, not expired, and the activity hasn't started.
2. For a vouch, check the guest's contact matches.
3. Find the guest by their contact, or create them. A new guest gets a generation one higher than whoever invited them.
4. Reserve a spot through the same booking module as everyone else.
5. Add the booking to the right plan.
6. Write the attribution row and the `spot_claimed` event.
7. Return the guest's user id, which the app keeps on the device so they're signed in next time. There's no password. In production a one-time code sent to their contact would verify it and give them a real login.

If anything fails, the whole thing rolls back, spot included. Two people racing to claim the same vouch can't both get in either, because there's a unique index on attributions for vouch invites.

The attribution history can't be rewritten. `invites`, `invite_revocations` and `attributions` only accept inserts. A database trigger rejects any update or delete, so this holds even against a bug in my code or someone running a bad query by hand. When something changes, like an invite being revoked, that's a new row. Whether a vouch has been used isn't a flag that gets flipped. It's whether an attribution row exists for it.

Each attribution also copies the rail and code as they were at the moment of the claim, so the record stands on its own.

Generation is set when a user is created and never touched again. People who found Velio themselves are generation 0. If an existing user claims an invite, they keep their generation, and the attribution records the hop for that claim.

You can't claim your own invite. Invite codes are 8 characters from an alphabet without lookalike letters, about 40 bits of randomness, and claims are rate-limited per IP and per code, so guessing codes isn't practical.

### API

| Endpoint                                 | What it's for                                                                                                                     |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /me`                                | Who you are                                                                                                                       |
| `GET /activities`, `GET /activities/:id` | Browsing and detail, with live counts and whether invites are on for that activity                                                |
| `POST /activities`                       | Hosts create activities                                                                                                           |
| `GET /activities/:id/stream`             | Live spot updates                                                                                                                 |
| `POST /activities/:id/bookings`          | Book a spot                                                                                                                       |
| `POST /bookings/:id/cancel`              | Give a spot back                                                                                                                  |
| `POST /invites`                          | Create a vouch or a public link                                                                                                   |
| `GET /invites/:code`                     | Look up an invite for the landing page                                                                                            |
| `POST /invites/:code/claim`              | Claim a spot through an invite                                                                                                    |
| `POST /invites/:code/revoke`             | Turn off a link, written as a revocation row                                                                                      |
| `GET /me/plans`                          | What you're going to and what you're hosting                                                                                      |
| `GET /me/invites`                        | Every invite you've sent with its status: joined, opened, not opened, opened when full, expired                                   |
| `PATCH /me/preferences`                  | The guest's reminder and friend update choices                                                                                    |
| `POST /activities/:id/photos`            | The host uploads photos for their activity: JPG, PNG or WebP, up to 10 MB each, at most 6. Stored on local disk for the prototype |
| `POST /events`                           | Events only the client can see                                                                                                    |
| `GET /metrics`, `GET /admin/health`      | Technical metrics and how each goal is doing                                                                                      |

Errors come back with a fixed set of codes (`SOLD_OUT`, `ALREADY_BOOKED`, `INVITE_EXPIRED`, `INVITE_USED`, `INVITE_NOT_FOR_YOU`, `ACTIVITY_STARTED`, `RATE_LIMITED`, `TRY_AGAIN`). Web and mobile each map them to the same screens, so a guest gets the same explanation whichever device they're on.

### Rolling it out

Invites go out behind a feature flag. Booking never depends on the flag, so switching invites off can't break bookings.

The flag is decided per activity, by hashing the activity id. 10% of activities are set aside as the holdout from day one and never get invites, even while the rest ramps up. If the holdout were only carved out at the end, some of those activities would already have had invites during the ramp and the comparison would be muddied. Everyone looking at the same activity sees the same thing, on every device.

I'd turn it on for the team first to check events and attribution end to end, then for 5% of activities for a couple of days, then 50%, then all 90% outside the holdout, keeping the holdout for at least four weeks. There's a kill switch that turns invites off everywhere without a deploy.

I'd stop the rollout if there's any oversell at all, if booking success drops under 99.5%, if live updates go over 2 seconds at p95, or if more than 1% of invite actions fail.

### What worries me

- **Guests landing on full activities.** The biggest product risk, covered under question 1. Mitigated for now by showing live spots, offering "notify me", and measuring it so we know how big the problem is.
- **Guests without the app.** If an invite link only works in the app, a lot of first-time guests will give up at the app store. Links open a web page that lets them claim in the browser.
- **Popular activities queuing on one row.** Fine at current sizes. There's a known path if that changes.
- **Redis going down.** Bookings carry on, because they only need Postgres. Live updates fall back to polling.
- **Abuse.** Guessable codes, vouch spam and self-invites are covered above.
- **Personal data in analytics.** Contacts are only ever stored as an HMAC and never appear in events, URLs or logs.
- **Time zones.** Easy to get subtly wrong. Times are stored in UTC and shown in the activity's own zone.

---

## 1c. Product plan

### Hosts

A host creates an activity with a title, description, location, local date and time, price and number of spots. They see their activities with spots updating live. Opening one shows who's coming, grouped by plan, so they can tell a group of five friends from five people who came alone. Hosts can share a public link or vouch for someone, like anyone else.

### Bookers

A booker browses activities with live spots and local times. They tap Book and the count drops straight away, then the server confirms it or puts it back. On success they land on a "you're going" screen with the invite options right there. That's on purpose. Right after booking is when you're thinking about who to bring.

They can vouch for a particular friend or share a link anywhere. When they vouch, they can note who it's for, just for themselves. Afterwards they can see their plan, who has claimed, and how many spots are left on the activity, so they know whether to chase anyone.

My plans splits what you're going to from what you're hosting, because plenty of people do both. My invites lists every invite you've sent and what happened to it: joined, opened but not claimed, not opened yet, opened after the activity filled, or expired. An invite showing as opened tells the inviter something about the person they invited, a bit like a read receipt. Between friends I think that's fine and it's what makes nudging useful, but it's a choice I'd raise with the product owner.

### Invited guests

The guest taps a link or types a code. If they have the app, it opens there. If they don't, the web page does everything the app does, so nobody is sent to an app store just to accept an invite.

They see who invited them (and "vouched for you" if it's a vouch), what the activity is, when, how much, and how many spots are left. New guests give a name and a phone number or email, and that's it. They tap Claim, the phone gives a little buzz, and they see "You're in Ada's plan" with everyone else who's going. Claiming also sets up their Velio account, and the screen says so. Two choices sit under the plan: a reminder the day before, on by default because it's about something they just booked, and updates when Ada plans something new, off by default because that's promotional and needs a real yes. From there they can invite their own friends.

### When things go wrong

- **The last spot goes while you're booking.** The count goes back up and the page says someone just got there first. We show other dates from the same host or let you get notified. No error codes on screen.
- **Your invite is for a full activity.** You still see who invited you and what it was, so it doesn't feel like a broken link. Then the same options: get notified, or see what else the host is running.
- **The invite expired, or the activity already started.** We say so plainly and show what's coming up.
- **Someone already used this vouch.** "This invite has already been claimed," and a suggestion to ask the person who sent it.
- **A vouch meant for someone else.** "This invite was meant for someone else," without saying who.
- **The guest is offline.** The activity details still show from the cache, with a banner saying they're offline. Claiming needs a connection, so we keep what they typed and the idempotency key and let them claim with one tap when they're back. A flaky connection can't turn into two bookings.
- **The guest is already going.** We tell them and show their plan.

### What I'll build in the 48 hours

I'm building in two tiers. Each app gets its first tier working end to end before anything from the second.

First tier, the parts the feature depends on:

- The backend: booking, cancelling, both kinds of invite, attribution, the feature flag, live updates and metrics.
- The concurrency tests, including the check against the broken version.
- The web app: explore, activity with booking and every sold-out and booked state, the invite landing page with claiming in the browser, creating an activity, live attendance for hosts, and an admin page that shows every goal against its target.
- The Flutter app: the full guest flow, then explore, booking and inviting through the phone's share sheet.
- 30 days of made-up data that reproduces the Part 4 scenario, so the ownership plan points at real queries and not guesses.
- A short load test, with the results written up against the targets.

Second tier, what makes it feel like a product:

- My plans and My invites on web and mobile.
- The screen for an activity you're going to, with your group and your invites.
- Creating an activity and live attendance on mobile.
- The reminder choices on "You're in".
- Photos for activities, last, since uploads are the most work for the least effect on the goals.

The brief only asks for the guest journey on mobile. I'm adding the booker flow because people book and invite from their phones, and that's the moment the whole invite funnel depends on.

### What I'd build next

1. Holding a spot for vouch invites for a limited time, if the data shows a lot of invites landing on full activities.
2. A waitlist that fills cancelled spots. The cancellation model is already there for it.
3. A reminder to friends who haven't claimed yet, before the activity fills.
4. Check-in at the venue, so "plans that happened" is measured, not guessed.
5. Push notifications, and proper universal links instead of a custom URL scheme.
6. A one-time code sent to the guest's contact at claim time, so the vouch is properly verified and the account works on any device.
7. After the activity, "Do another one with Ada and Tunde?", so a group that went once plans the next thing together.
8. Photo uploads straight to object storage with presigned URLs, and basic moderation, since anyone can host.

---

## 1d. Tracking plan

### Events

| Event               | Sent from | Properties                                     |
| ------------------- | --------- | ---------------------------------------------- |
| `activity_viewed`   | client    | activity, platform, came from an invite or not |
| `booking_attempted` | server    | activity, direct or invite                     |
| `booking_succeeded` | server    | activity, plan, direct or invite               |
| `booking_rejected`  | server    | activity, sold out or already booked           |
| `booking_failed`    | server    | activity, error code                           |
| `invite_created`    | server    | rail, activity, plan                           |
| `invite_opened`     | client    | rail, code, platform, spots left when opened   |
| `claim_attempted`   | server    | rail, code                                     |
| `spot_claimed`      | server    | rail, code, new or existing user, generation   |
| `user_created`      | server    | generation, which rail brought them            |
| `flag_exposed`      | server    | flag, variant                                  |

Server events that record something changing (a booking, an invite, a claim) are written in the same transaction as the change. If the booking rolls back, so does the event, so the funnel can never claim something happened that didn't.

The property I expect to use most is "spots left when opened." It separates two very different problems: guests who don't want to come, and guests who would have come but found nothing left.

### Goals and triggers

| Goal                            | What I measure                                                                                                                                                                                                                        | Target    | When I'd write an improvement plan                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------- |
| Never oversell                  | Activities where confirmed bookings exceed capacity. The same scheduled query also flags any activity where `spots_taken` doesn't match its confirmed bookings, since drift there would mean the guard is working from a wrong number | Zero      | Any result at all. That's an incident, not a plan                             |
| Bookings work when there's room | Successful bookings over attempts, not counting correct sold-outs                                                                                                                                                                     | 99.5%     | Under 99.5% for any hour with at least 500 attempts, or for a whole day       |
| Updates feel live               | p95 from a booking committing to clients getting it                                                                                                                                                                                   | 2 seconds | Over 2 seconds for 15 minutes                                                 |
| Bookers invite                  | Bookers who create an invite within 7 days, on activities where invites are on                                                                                                                                                        | 30%       | Under 30% for two weekly cohorts in a row, each with at least 200 bookers     |
| Invites turn into guests        | Unique opens that end in a claim within 7 days, for each rail separately                                                                                                                                                              | 25%       | Under 25% on either rail for two weekly cohorts, each with at least 200 opens |

The minimum cohort sizes are there so one quiet week doesn't send me off rebuilding things.

I'll also watch a few numbers without targets: K-factor per rail, plans still at two or more people when the activity starts, the share of opens that land on a full activity, how long it takes from invite to claim, invites that were created but never opened, the whole funnel split by platform and by new versus existing guests, invited guests who book something on their own within 30 days, and how many guests turn on each reminder choice.

### Holdout

One in ten activities, picked by hashing the activity id, never has invites switched on. Nobody booking them sees invite options, on any device. I'm splitting by activity rather than by user for two reasons. In this model, the only way to get a plan of two or more is through an invite, so if I split by user, the holdout couldn't form group plans by definition and the comparison would be rigged in favour of invites. And the real question isn't whether invited friends turn up. It's whether invites bring more people to activities overall, or just turn people who would have booked anyway into invitees. Comparing whole activities with and without invites answers that.

So the main comparison is confirmed attendees per activity at start time, alongside new users whose first booking was on that activity. I'd also watch the booking rate per activity view, to make sure the invite screens aren't getting in the way of booking itself. Since the split is decided before anyone books and has nothing to do with how popular an activity or how sociable its bookers are, a difference between the two groups is something invites caused. Activities vary a lot in how popular they are, so I'd compare within host and category and run it for at least four weeks, with the sample size worked out before starting rather than stopping when the numbers look good. One cost of this design is that there are far fewer activities than users, which is why it needs to run for a while. Someone can also book a holdout activity and a normal one in the same month, but that only affects them as a person, not the attendance of each activity, which is what's being measured.

### Where to look

- `/metrics` for the technical counters and the latency histogram, in Prometheus format.
- `/admin` for a page showing each goal with its current number, target and trigger, in green or red.
- SQL views for each product goal, the holdout comparison and the oversell check. The README has the commands to run them.

---

## Deviations

| When | What changed | Why |
| ---- | ------------ | --- |
|      |              |     |
