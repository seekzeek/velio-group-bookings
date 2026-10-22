# Velio API

The HTTP contract between the backend and the web and mobile apps. Every screen in the apps is built from this document. If the backend and this document disagree, the document is the bug report.

Base URL in development: `http://localhost:4000`. Everything is JSON except the SSE stream, the Prometheus endpoint and photo uploads.

## Conventions

Identity
- There is no real authentication. Requests that act as a user send `x-user-id: <uuid>`. The web header picker and the mobile app set it. `GET /users` lists the users you can pick.
- A guest who claims an invite gets a user id back. The app stores it and sends it from then on.
- Endpoints marked **identity** return `401 UNAUTHENTICATED` without a valid `x-user-id`. Endpoints marked **public** work without one, and use it only to add a `viewer` section when present.
- Endpoints marked **host** or **inviter** or **member** return `403 FORBIDDEN` when the user isn't that.

Shapes
- Ids are UUIDs. Timestamps are ISO 8601 in UTC (`2026-11-14T16:30:00.000Z`). Activities carry an IANA `timezone`; clients format `startsAt` in that zone and label it "local time".
- Money is `{ "amountMinor": 4500, "currency": "USD" }`. Clients format it.
- Invite codes are 8 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I, L). The API stores and accepts them without the dash and in any case. `codeDisplay` is the grouped form `AX7K-29QM` for screens.
- Lists aren't paginated. The prototype's data is small.
- Idempotency keys travel in the request body as `idempotencyKey`, a client-generated UUID, scoped to the user. Replaying a key returns the original result with `"replayed": true` and status 200.

Errors
```json
{ "error": { "code": "SOLD_OUT", "message": "Someone got there a second before you.", "details": { "spotsLeft": 0 } } }
```
`code` is stable and is what the apps switch on. `message` is written for people and is safe to show, but each app maps codes to its own screens. `details` is optional. The full list is in [Error codes](#error-codes).

Live counts
- Every object that carries `spotsTaken` and `capacity` also carries `spotsLeft` and `version`. Clients that hold an activity open subscribe to its stream and replace the counts whenever they get a message with a higher `version`.
- Shared display rules so web and mobile match: `N of 12 spots left`; `Last spot of 12` when one is left; `Full · 12 of 12 booked` at zero. Scarcity colour at 3 or fewer left. Explore cards show "Filling fast" when `spotsLeft > 0` and `spotsLeft <= ceil(capacity / 3)`.

Rate limits
- Claims: 20 per 10 minutes per IP and 10 per 10 minutes per code. Invite lookups: 60 per minute per IP. Bookings: 30 per minute per user. Everything else: 300 per minute per IP.
- Over the limit returns `429 RATE_LIMITED` with a `Retry-After` header and `details.retryAfterSeconds`.

Feature flag
- Invites are decided per activity. `activity.invitesEnabled` is the only thing clients read. When it's false, no invite UI is shown, and the API also rejects `POST /invites` and claims for that activity with `403 INVITES_OFF`.
- Buckets 0 to 9 of `hash(activityId + salt) % 100` are the holdout and never get invites. The rollout percentage ramps through buckets 10 to 99. A kill switch turns invites off everywhere.

---

## Objects

### Activity

```json
{
  "id": "7d1c2f4e-…",
  "title": "Sunset Kayaking",
  "description": "Two hours on calm water as the sun goes down. Boats, paddles and a guide included. No experience needed.",
  "category": "outdoors",
  "illustration": "kayak",
  "location": "Harbour jetty, pier 3",
  "startsAt": "2026-11-14T16:30:00.000Z",
  "timezone": "Africa/Lagos",
  "price": { "amountMinor": 4500, "currency": "USD" },
  "capacity": 12,
  "spotsTaken": 11,
  "spotsLeft": 1,
  "version": 14,
  "status": "open",
  "host": { "id": "b3a1…", "displayName": "Kemi" },
  "photos": [{ "id": "9f…", "url": "http://localhost:4000/uploads/9f….jpg", "position": 0 }],
  "plansCount": 5,
  "invitesEnabled": true,
  "viewer": null,
  "createdAt": "2026-10-20T09:00:00.000Z"
}
```

- `category`: `outdoors` | `nights_out` | `food_and_drink` | `classes` | `other`. Explore filters and the badge on cards use it.
- `illustration`: `kayak` | `hike` | `speakeasy` | `salsa` | `market` | `pottery` | `other`. The illustrated cover to draw when `photos` is empty. The server picks one that fits the category at creation. The cover is `photos[0]` when there is one.
- `status`: `open` (spots left and not started), `full` (no spots left), `started` (`startsAt` is in the past). Derived on every read.
- `plansCount`: plans with at least one confirmed person. "5 groups going".
- `viewer`: present when `x-user-id` is sent and that user holds a confirmed booking. `{ "bookingId", "planId", "planRole": "owner" | "member", "joinedVia": "direct" | "vouch" | "public" }`. Otherwise `null`.

An **activity summary** is the same object without `description`, `photos` beyond the first, `plansCount` and `viewer`. Lists of plans and invites embed summaries.

### Plan and members

```json
{
  "id": "c0de…",
  "activityId": "7d1c…",
  "owner": { "id": "a1…", "displayName": "Ada" },
  "members": [
    { "userId": "a1…", "displayName": "Ada", "role": "owner", "joinedVia": "direct", "invitedBy": null, "joinedAt": "2026-11-02T10:00:00.000Z" },
    { "userId": "t2…", "displayName": "Tunde", "role": "member", "joinedVia": "vouch", "invitedBy": { "id": "a1…", "displayName": "Ada" }, "joinedAt": "2026-11-02T18:12:00.000Z" },
    { "userId": "c3…", "displayName": "Chioma", "role": "member", "joinedVia": "vouch", "invitedBy": { "id": "a1…", "displayName": "Ada" }, "joinedAt": "2026-11-10T16:40:00.000Z" }
  ],
  "membersCount": 3,
  "createdAt": "2026-11-02T10:00:00.000Z"
}
```

Only confirmed bookings appear as members. How a member arrived, in words: `direct` → "booked" or "started the plan"; `vouch` → "vouched by Ada" or "claimed your vouch", "vouched by you" when `invitedBy.id` is the viewer; `public` → "from Ada's link" or "joined from your link".

### Invite, as the inviter sees it

```json
{
  "id": "e5…",
  "code": "AX7K29QM",
  "codeDisplay": "AX7K-29QM",
  "url": "http://localhost:3000/i/AX7K29QM",
  "rail": "vouch",
  "activityId": "7d1c…",
  "planId": "c0de…",
  "isHostInvite": false,
  "recipientLabel": "Dami",
  "status": "opened",
  "opensCount": 1,
  "firstOpenedAt": "2026-11-11T19:02:00.000Z",
  "lastOpenSpotsLeft": 2,
  "joinedCount": 0,
  "joinedAt": null,
  "invitee": null,
  "createdAt": "2026-11-10T09:30:00.000Z",
  "expiresAt": "2026-11-14T16:30:00.000Z",
  "revokedAt": null
}
```

- `recipientLabel` is the inviter's own note of who a vouch is for. It is only ever returned to the inviter. Guests never see it and the recipient contact is never returned to anyone.
- `status` for a vouch: `not_opened` | `opened` | `opened_when_full` | `joined` | `expired` | `revoked`. Priority when several apply: joined, revoked, expired, opened_when_full, opened, not_opened. `opened_when_full` means the most recent open saw zero spots left and nobody claimed.
- `status` for a public link: `active` | `expired` | `revoked`, with `opensCount` (unique openers) and `joinedCount`.
- My invites groups: Waiting = `not_opened` + `opened`; Joined = `joined`; Missed = `opened_when_full` + `expired`.
- `invitee` is `{ "displayName", "wasNew": true }` once someone joined through a vouch. Public links don't list invitees here; they appear as plan members.

### User

```json
{ "id": "a1…", "displayName": "Ada", "generation": 0, "remindDayBefore": true, "friendUpdates": false, "hasContact": true, "createdAt": "…" }
```

---

## Endpoints

### Health

`GET /health` → `200 { "ok": true, "postgres": "up", "redis": "up" }`. `503` with the failing side marked `"down"`.

### Users and identity

`GET /users` **public**. The list for the user picker.
```json
{ "users": [ { "id": "b3…", "displayName": "Kemi", "generation": 0, "isHost": true }, { "id": "a1…", "displayName": "Ada", "generation": 0, "isHost": false } ] }
```
Hosts first, then by name.

`GET /me` **identity** → `200 { "user": User }`.

`PATCH /me/preferences` **identity**
```json
{ "remindDayBefore": true, "friendUpdates": false }
```
Both optional. → `200 { "user": User }`.

### Activities

`GET /activities` **public**. Upcoming activities, soonest first.

Query parameters, all optional
- `category`: one of the category values.
- `hostId`: a user id, or `me` with identity.
- `sort`: `soonest` (default) | `filling` (fewest spots left first, full ones last) | `price` (cheapest first).
- `minSpotsLeft`: integer. "Has spots for a group" sends `4`.
- `from`, `until`: ISO timestamps on `startsAt`. "This week" sends `until` = end of the coming Sunday.
- `includePast`: `true` to include started activities.
- `excludeId`: leave one activity out, used for "same host, other dates".

→ `200 { "activities": [ Activity ] }`. `viewer` is filled on each when identity is sent.

`GET /activities/:id` **public** → `200 { "activity": Activity }` or `404 NOT_FOUND`. With identity, the first view by a user writes a flag exposure row; anonymous views pass `?anonId=` so exposures can be written for guests too.

`POST /activities` **identity**. The sender becomes the host.
```json
{
  "title": "Sunset Kayaking",
  "description": "Two hours on calm water as the sun goes down.",
  "category": "outdoors",
  "location": "Harbour jetty, pier 3",
  "startsAtLocal": "2026-11-14T17:30",
  "timezone": "Africa/Lagos",
  "price": { "amountMinor": 4500, "currency": "USD" },
  "capacity": 12
}
```
- `startsAtLocal` is the wall-clock time at the venue, `YYYY-MM-DDTHH:mm`. The server converts it with `timezone`. `startsAt` (ISO with offset) is accepted instead.
- Rules: title 3 to 80 characters, description up to 2000, location up to 200, capacity 1 to 500, amount 0 or more, currency a 3-letter code, start in the future, timezone a valid IANA name.
→ `201 { "activity": Activity }`. `400 VALIDATION` with `details.fields`.

`PATCH /activities/:id` **host**. Any of the fields above. Capacity can't go below `spotsTaken` (`400 VALIDATION`, `details.fields.capacity`). → `200 { "activity": Activity }`.

`GET /activities/:id/attendance` **host**. The live attendance page.
```json
{
  "activity": Activity,
  "totals": {
    "booked": 11, "capacity": 12, "spotsLeft": 1, "version": 14,
    "plansCount": 5, "groupsOfTwoOrMore": 3,
    "viaInvites": { "total": 7, "vouch": 4, "public": 3 }
  },
  "plans": [
    { "id": "c0de…", "owner": { "id": "a1…", "displayName": "Ada" }, "members": [ Member ], "membersCount": 3, "latestJoinAt": "2026-11-10T16:40:00.000Z", "createdAt": "…" }
  ]
}
```
Plans are ordered by size, largest first, then oldest first. A plan of one is "coming solo so far". `latestJoinAt` drives "Chioma joined just now" and the "New" tag (within the last hour). Clients refetch this when the stream's version moves.

`POST /activities/:id/watch` **public**. "Tell me if a spot opens." Records the intent only; nothing notifies anyone yet, and this is the row a waitlist would read.
```json
{ "anonId": "d1f0…", "contact": "+1 555 010 0100" }
```
Identity or `anonId` is required. `contact` is optional and stored only as an HMAC. → `201 { "watching": true }`, or `200` if already watching.

#### Photos

`POST /activities/:id/photos` **host**. Multipart, one file in field `photo`, so each upload has its own progress bar. JPG, PNG or WebP, up to 10 MB, at most 6 per activity. The new photo goes last; the first photo is the cover.
→ `201 { "photo": { "id", "url", "position" } }`. `413 PHOTO_TOO_LARGE`, `415 PHOTO_TYPE`, `409 PHOTO_LIMIT`.

`DELETE /activities/:id/photos/:photoId` **host** → `204`. Positions close up.

`PUT /activities/:id/photos/order` **host**
```json
{ "photoIds": ["9f…", "2a…"] }
```
Must list every photo once. → `200 { "photos": [ Photo ] }`.

Files are served from `GET /uploads/<file>` in development. Production would use object storage with presigned uploads.

#### Live availability stream

`GET /activities/:id/stream` **public**, `Accept: text/event-stream`. No identity, no compression, `Cache-Control: no-cache`, `X-Accel-Buffering: no`.

```
retry: 3000

event: availability
id: 14
data: {"activityId":"7d1c…","spotsTaken":11,"capacity":12,"spotsLeft":1,"version":14,"at":"2026-11-10T16:40:01.120Z"}

event: heartbeat
id: 14
data: {"version":14,"at":"2026-11-10T16:40:16.000Z"}
```

- On connect the server sends an `availability` snapshot straight away.
- Every change sends an `availability` event. `id` is the activity's `version`.
- Every 15 seconds the server sends a `heartbeat` with the current version. A client whose last seen version is lower than the heartbeat's missed something: refetch `GET /activities/:id`.
- Clients ignore any message whose `version` is not higher than the one they hold.
- If the stream can't connect, clients poll `GET /activities/:id` every 10 seconds and show the counts without the "Live" tag.
- A toast "Someone just booked · N left" is shown when `spotsTaken` goes up while the page is open and the viewer didn't cause it.

### Bookings

`POST /activities/:id/bookings` **identity**. Books one spot and starts a new plan owned by the booker.
```json
{ "idempotencyKey": "6b9a…", "platform": "web", "anonId": "d1f0…" }
```
→ `201`
```json
{
  "booking": { "id": "f4…", "status": "confirmed", "createdAt": "…" },
  "plan": Plan,
  "activity": Activity,
  "replayed": false
}
```
- `activity` carries the counts after the booking, so the client can replace its optimistic count with the real one.
- Replaying the key returns `200` with the same body and `"replayed": true`.
- `409 SOLD_OUT` with `details: { "spotsLeft": 0, "hostId": "b3…" }`. The client rolls back the optimistic count and shows the sold-out state with the host's other dates.
- `409 ALREADY_BOOKED` with `details: { "bookingId", "planId" }`.
- `410 ACTIVITY_STARTED`. `503 TRY_AGAIN` when the transaction timed out.

`POST /bookings/:id/cancel` **identity**, the booking's owner. Sets the booking to cancelled and gives the spot back in the same transaction. No UI uses it yet; it exists so a waitlist can.
→ `200 { "booking": { "id", "status": "cancelled", "cancelledAt" }, "activity": { "spotsTaken", "spotsLeft", "capacity", "version" } }`. Cancelling twice returns the same `200`.

### Plans

`GET /plans/:id` **member** → `200 { "plan": Plan, "activity": Activity }`. The host of the activity can read any plan on it.

`GET /me/plans` **identity**. Everything you're going to and everything you're running.
```json
{
  "going": [
    {
      "plan": Plan,
      "activity": ActivitySummary,
      "viewerRole": "owner",
      "viewerJoinedVia": "direct",
      "pendingVouches": 1
    }
  ],
  "hosting": [
    {
      "activity": ActivitySummary,
      "attendance": { "plansCount": 5, "groupsOfTwoOrMore": 3, "viaInvites": { "total": 7, "vouch": 4, "public": 3 } }
    }
  ],
  "past": []
}
```
- `going` is upcoming only, soonest first. `?includePast=true` fills `past` with the same shape.
- `pendingVouches` counts the viewer's vouches on that plan that are still claimable: not joined, not expired, not revoked. "1 vouch not claimed yet".
- The hosting summary line ("19 of 36 spots booked across 3 activities · 9 groups") is added up by the client.

### Invites

`POST /invites` **identity**. Create a vouch or a public link.
```json
{ "rail": "vouch", "activityId": "7d1c…", "recipientContact": "+1 555 010 0100", "recipientLabel": "Tunde" }
```
```json
{ "rail": "public", "activityId": "7d1c…" }
```
- The plan is worked out server side. If the sender has a confirmed booking on the activity, the invite joins their plan. If the sender is the host and has no booking, it's a host invite (`planId` null) and the guest starts their own plan. Anyone else gets `403 NOT_GOING`.
- Vouch: `recipientContact` is required, a phone number or email. It's normalised (phones to E.164 using the default region, emails trimmed and lowercased), hashed with the server secret, and the raw value is dropped. `recipientLabel` is optional, up to 40 characters, and only the inviter ever sees it. At most 10 vouches per user per activity: `409 VOUCH_LIMIT`.
- Public: there is one active public link per sender per activity. Calling again returns the existing one with `"created": false` and status `200`. Clients create it on the first Copy or Share tap, not on page load, so that "bookers who invite" measures intent.
- Every invite expires when the activity starts. `410 ACTIVITY_STARTED` if it already has. `403 INVITES_OFF` when `invitesEnabled` is false for the activity.
→ `201 { "invite": Invite, "created": true }`.

`GET /invites/:code` **public**. Resolves a code for the landing page. Never an error for a known code: the status is in the body so the screen can still show who invited them and to what.
```json
{
  "code": "AX7K29QM",
  "codeDisplay": "AX7K-29QM",
  "rail": "vouch",
  "isHostInvite": false,
  "status": "open",
  "inviter": { "id": "a1…", "displayName": "Ada" },
  "activity": Activity,
  "plan": { "id": "c0de…", "owner": { "id": "a1…", "displayName": "Ada" }, "members": [ Member ], "membersCount": 2 },
  "expiresAt": "2026-11-14T16:30:00.000Z",
  "viewer": null
}
```
- `status`: `open` | `expired` | `used` | `revoked` | `started` | `off`. `used` only happens for vouches. `started` means the activity began. `off` means invites are no longer on for the activity (kill switch). Each maps to the error code the claim would return: `INVITE_EXPIRED`, `INVITE_USED`, `INVITE_REVOKED`, `ACTIVITY_STARTED`, `INVITES_OFF`.
- Whether the activity is full is read from `activity.spotsLeft`; the page shows the filled-up state when it's 0 and the status is `open`.
- `plan` is `null` for host invites; the page shows "Kemi is hosting · 5 groups going so far" from `activity.plansCount`.
- `viewer` with identity: `{ "alreadyInPlan": true, "bookingId", "planId" }` when that user already holds a spot on the activity.
- Unknown code: `404 INVITE_NOT_FOUND`.
- The enter-code screen shows `activity.title`, the date and `inviter.displayName` from this response.

`POST /invites/:code/claim` **public**, identity optional. Claims a spot through the invite in one transaction: checks the invite, finds or creates the guest, reserves the spot through the booking module, joins or creates the plan, writes the attribution.
```json
{
  "idempotencyKey": "0c1d…",
  "displayName": "Chioma",
  "contact": "+1 555 010 0100",
  "platform": "mobile",
  "anonId": "d1f0…"
}
```
- Without identity: `displayName` (1 to 60 characters) and `contact` are required. The guest is found by the contact's HMAC or created with `generation = inviter.generation + 1`, `remindDayBefore = true`, `friendUpdates = false`.
- With identity: the existing user claims. `displayName` is ignored. For a vouch, `contact` is required unless the user already has a contact on file, and whichever is used must match the vouch.
- For a vouch the contact HMAC must equal the invite's recipient HMAC: `403 INVITE_NOT_FOR_YOU`.
- The inviter can't claim their own invite: `400 VALIDATION`.
→ `201`
```json
{
  "userId": "c3…",
  "isNewUser": true,
  "generation": 1,
  "booking": { "id": "f5…", "status": "confirmed", "createdAt": "…" },
  "plan": Plan,
  "activity": Activity,
  "replayed": false
}
```
The app stores `userId` on the device and sends it as `x-user-id` from then on.

Errors, in the order they're checked: `404 INVITE_NOT_FOUND`, `410 INVITE_REVOKED`, `410 INVITE_EXPIRED`, `410 ACTIVITY_STARTED`, `403 INVITES_OFF`, `409 INVITE_USED`, `403 INVITE_NOT_FOR_YOU`, `409 ALREADY_BOOKED` (with `details.planId`, the guest is already going), `409 SOLD_OUT` (with `details.hostId`), `503 TRY_AGAIN`, `429 RATE_LIMITED`.

`POST /invites/:code/revoke` **inviter**. Turns a link off. Written as a new revocation row; the invite row never changes.
```json
{ "reason": "turned_off" }
```
→ `200 { "invite": Invite }` with `status: "revoked"`. Revoking twice returns the same. There is no un-revoke: to share again, create a new link with `POST /invites`.

`GET /me/invites` **identity**. Every invite you've sent, grouped by activity.
```json
{
  "summary": { "sent": 7, "vouches": 6, "links": 1, "joined": 2, "joinedNew": 2, "waiting": 2, "missed": 2 },
  "activities": [
    {
      "activity": ActivitySummary,
      "planId": "c0de…",
      "viewerGroupSize": 3,
      "invites": [ Invite ]
    }
  ]
}
```
- `?activityId=` narrows to one activity, for "your invites for this" on the activity you're going to.
- Ordered with upcoming activities first by start, then past ones most recent first. Invites within an activity newest first.
- "Nudge" and "Copy link again" are client actions: they re-share `invite.url` and send an `invite_nudged` or `invite_link_copied` event. Nothing is sent by the server.

### Tracking

`POST /events` **public**, identity optional. Events only the client can see.
```json
{
  "name": "invite_opened",
  "anonId": "d1f0…",
  "platform": "mobile",
  "activityId": "7d1c…",
  "inviteCode": "AX7K29QM",
  "props": { "spotsLeftAtOpen": 2 }
}
```
- `name` is one of: `activity_viewed` (props `fromInvite`), `invite_opened` (props `spotsLeftAtOpen`), `claim_started`, `claim_submitted`, `invite_link_copied`, `invite_link_shared`, `invite_nudged`, `invite_missed`. Anything else is `400 VALIDATION`.
- `platform` is `web` | `mobile`. `anonId` is a client-generated UUID kept on the device, used for unique opens. `inviteCode` is resolved to the invite id and rail server side; props may only contain `spotsLeftAtOpen` (integer), `fromInvite` (boolean) and `rail`. Nothing personal is accepted.
→ `202 {}`.

`GET /metrics` **public**. Prometheus text format: booking attempts, successes, sold-out rejections, errors by code, claim counters by rail, the commit-to-SSE-write latency histogram, open SSE connections, and default process metrics.

`GET /admin/health` **public** in the prototype. Every goal from the scope against its target.
```json
{
  "source": "live",
  "generatedAt": "…",
  "window": { "from": "…", "to": "…" },
  "goals": [
    { "key": "never_oversell", "label": "Never oversell", "current": 0, "currentDisplay": "0", "target": 0, "targetDisplay": "0, ever", "trigger": "Any result", "status": "on_target" },
    { "key": "bookings_succeed", "label": "Bookings work when there's room", "current": 0.999, "currentDisplay": "99.9%", "target": 0.995, "targetDisplay": "99.5%", "trigger": "Under 99.5% in an hour with 500+ attempts", "status": "on_target" },
    { "key": "updates_live", "label": "Updates feel live (p95)", "current": 0.4, "currentDisplay": "0.4 s", "target": 2, "targetDisplay": "2 s", "trigger": "Over 2 s for 15 min", "status": "on_target" },
    { "key": "bookers_invite", "label": "Bookers invite", "current": 0.34, "currentDisplay": "34%", "target": 0.3, "targetDisplay": "30%", "trigger": "Under 30% two cohorts running", "status": "on_target" },
    { "key": "invites_convert", "label": "Invites turn into guests", "current": 0.11, "currentDisplay": "11%", "target": 0.25, "targetDisplay": "25% per rail", "trigger": "Under 25% two cohorts running", "status": "trigger_fired" }
  ],
  "triggers": [ { "goalKey": "invites_convert", "message": "Claim rate is under target on both rails for two weekly cohorts." } ],
  "claimRateByRail": { "vouch": 0.21, "public": 0.08, "definition": "Unique opens that end in a claim within 7 days" },
  "opensOnFullShare": 0.38,
  "holdout": { "holdoutPercent": 10, "weeksElapsed": 3, "weeksPlanned": 4, "note": "10% of activities have no invites. Attendees per activity are compared within host and category once the planned sample is reached." },
  "diagnosisQueries": [ { "title": "Opens that landed on a full activity, by rail and day since send", "sql": "select …" } ]
}
```
- `?source=scenario` reads the Part 4 scenario database when `SCENARIO_DATABASE_URL` is set; otherwise `live`. `status` is `on_target` | `trigger_fired` | `no_data`.

`GET /admin/flags` **public** in the prototype.
```json
{ "invites": { "enabled": true, "rolloutPercent": 100, "holdoutPercent": 10, "holdoutActivityIds": ["…"] } }
```

`PATCH /admin/flags/invites`
```json
{ "enabled": false, "rolloutPercent": 50 }
```
Either field. `enabled: false` is the kill switch. → `200` with the same shape as `GET`.

---

## Error codes

| Code | HTTP | When | What the apps show |
| --- | --- | --- | --- |
| `SOLD_OUT` | 409 | Booking or claim found no spot left | "Someone got there a second before you" with the host's other dates and "Tell me if a spot opens". Invite pages show "This one filled up before you got here" |
| `ALREADY_BOOKED` | 409 | The user already holds a confirmed spot on the activity | "You're already going", link to their plan (`details.planId`) |
| `ACTIVITY_STARTED` | 410 | The activity has begun; booking, inviting and claiming are closed | "This one has already started" with what's coming up |
| `INVITE_NOT_FOUND` | 404 | Code doesn't exist | "We can't find that code. Check it with whoever sent it." |
| `INVITE_EXPIRED` | 410 | The invite's `expiresAt` has passed | "This invite has expired. It was for … on …" with Explore |
| `INVITE_USED` | 409 | The vouch was already claimed | "This invite has already been claimed. Ask the person who sent it." |
| `INVITE_REVOKED` | 410 | The inviter turned the link off | "This link was turned off by the person who shared it." |
| `INVITE_NOT_FOR_YOU` | 403 | Contact doesn't match the vouch | "This invite was sent to a different number or email. Check with Ada which one she used." on the contact field |
| `INVITES_OFF` | 403 | Activity is in the holdout, outside the rollout, or the kill switch is on | Invite UI is hidden; a claim says "Invites aren't available for this activity" and offers to book directly |
| `VOUCH_LIMIT` | 409 | More than 10 vouches by one user on one activity | "You've vouched for 10 people on this one. Share the link instead." |
| `NOT_GOING` | 403 | Creating an invite without a booking and without being the host | "Book a spot first, then bring your people" |
| `PHOTO_TOO_LARGE` | 413 | File over 10 MB | "This one's over 10 MB. Try a smaller photo." |
| `PHOTO_TYPE` | 415 | Not JPG, PNG or WebP | "Photos need to be JPG, PNG or WebP." |
| `PHOTO_LIMIT` | 409 | Already 6 photos | "That's the limit of 6 photos." |
| `VALIDATION` | 400 | A field is missing or wrong; `details.fields` maps field to message | Inline field messages |
| `UNAUTHENTICATED` | 401 | No or unknown `x-user-id` on an identity endpoint | Pick a user (web) or the code screen (mobile) |
| `FORBIDDEN` | 403 | Not the host, inviter or member | "That isn't yours to change" |
| `NOT_FOUND` | 404 | Activity, plan or booking id doesn't exist | "We can't find that one" with Explore |
| `RATE_LIMITED` | 429 | Too many requests; `Retry-After` set | "Slow down a moment" with a retry after the wait |
| `TRY_AGAIN` | 503 | Transaction timed out or a dependency was unavailable | "Something went wrong on our side. Try again." with the same idempotency key, so a retry can't double book |

Unexpected failures return `500 { "error": { "code": "INTERNAL" } }` and are counted in `/metrics`. The apps treat `INTERNAL` like `TRY_AGAIN`.

---

## Screens and the data they use

| Screen | Endpoints | Fields that drive it |
| --- | --- | --- |
| Enter a code | `GET /invites/:code` | `status`, `activity.title`, `activity.startsAt`, `activity.timezone`, `inviter.displayName` |
| Guest invite (vouch, public, host, loading, last spot, full) | `GET /invites/:code`, `GET /activities/:id/stream`, `POST /events` `invite_opened` | `rail`, `isHostInvite`, `inviter`, `activity` (title, price, startsAt, timezone, location, photos, illustration, spotsLeft, capacity, plansCount), `plan.members`, `status`, `codeDisplay` |
| Guest details, wrong contact | `POST /invites/:code/claim`, `POST /events` `claim_started`, `claim_submitted` | request `displayName`, `contact`, `idempotencyKey`; errors `INVITE_NOT_FOR_YOU`, `INVITE_USED`, `SOLD_OUT`, `ALREADY_BOOKED` |
| You're in | claim response, `PATCH /me/preferences` | `userId`, `plan.members[].joinedVia`, `plan.owner`, `activity.spotsLeft`, `remindDayBefore`, `friendUpdates` |
| Filled up | `GET /invites/:code`, `GET /activities?hostId=&excludeId=`, `POST /activities/:id/watch`, `POST /events` `invite_missed` | `inviter.displayName`, `activity`, other activities' `startsAt`, `price`, `spotsLeft` |
| Offline | cached `GET /invites/:code` | saved response, saved form values, saved `idempotencyKey` |
| Mobile explore, web explore | `GET /activities`, `GET /users` (web picker), `POST /events` `activity_viewed` | `title`, `price`, `startsAt`, `timezone`, `location`, `host.displayName`, `category`, `illustration`, `photos[0]`, `spotsLeft`, `capacity`, `status`, `viewer` |
| Mobile activity, web activity (available, toast, sold out, booked, vouch sent, holdout) | `GET /activities/:id`, stream, `POST /activities/:id/bookings`, `GET /activities?hostId=&excludeId=`, `POST /invites`, `GET /me/invites?activityId=`, `POST /activities/:id/watch` | `plansCount`, `invitesEnabled`, `viewer`, booking response `plan.id`, invite `url`, `codeDisplay`, `recipientLabel`, `status` |
| You're going and invite sheet (mobile) | `POST /invites`, `POST /events` `invite_link_shared` | `invitesEnabled`, `viewer.planId`, invite `url`, `codeDisplay` |
| My plans (going, hosting, empty, past) | `GET /me/plans`, `POST /invites` public (share link) | `going[].plan.members[].joinedVia`, `viewerRole`, `pendingVouches`, `activity.spotsLeft`, `hosting[].attendance` |
| Activity you're going to | `GET /plans/:id`, `GET /me/invites?activityId=`, stream | `plan.members`, invites' `recipientLabel`, `rail`, `createdAt`, `status`, `opensCount`, `joinedCount`, `joinedAt` |
| My invites (filled, empty) | `GET /me/invites`, `POST /invites/:code/revoke`, `POST /events` `invite_nudged`, `invite_link_copied` | `summary`, `activities[].activity.status`, `spotsLeft`, invites' `status`, `recipientLabel`, `rail`, `createdAt`, `firstOpenedAt`, `joinedAt`, `invitee.wasNew` |
| Create activity (form, uploading, too large, published) | `POST /activities`, `POST /activities/:id/photos`, `DELETE …/photos/:photoId`, `PUT …/photos/order`, `POST /invites` | request fields, `PHOTO_*` errors, invite `url` |
| Host live attendance (live, empty) | `GET /activities/:id/attendance`, `GET /activities?hostId=me`, stream, `POST /invites` | `totals`, `plans[].members[].joinedVia`, `invitedBy`, `latestJoinAt` |
| Feature health | `GET /admin/health?source=` | `goals`, `triggers`, `claimRateByRail`, `opensOnFullShare`, `holdout`, `diagnosisQueries` |
| Web header, user picker | `GET /users`, `GET /me` | `displayName`, `isHost` |

Everything a screen shows comes from the fields above. If a screen needs something that isn't here, this file changes first.
