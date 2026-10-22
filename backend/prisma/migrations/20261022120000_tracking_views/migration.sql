-- The flag bucket is derived from the id and the salt in code. Storing it lets SQL split treatment from holdout without pgcrypto or the salt.
ALTER TABLE "activities" ADD COLUMN "flag_bucket" INTEGER NOT NULL DEFAULT -1;

CREATE VIEW activity_variants AS
SELECT id AS activity_id, host_id, category, starts_at, capacity, spots_taken, created_at,
       CASE WHEN flag_bucket BETWEEN 0 AND 9 THEN 'holdout' WHEN flag_bucket < 0 THEN 'unknown' ELSE 'treatment' END AS variant
FROM activities;

-- Goal: bookers invite. Anyone holding a confirmed spot on a treatment activity who created an invite for it within 7 days.
CREATE VIEW bookers_invite_rate AS
WITH bookers AS (
  SELECT b.user_id, b.activity_id, MIN(b.created_at) AS booked_at
  FROM bookings b JOIN activity_variants v ON v.activity_id = b.activity_id
  WHERE b.status = 'confirmed' AND v.variant = 'treatment'
  GROUP BY b.user_id, b.activity_id
), inviters AS (
  SELECT DISTINCT bk.user_id, bk.activity_id
  FROM bookers bk JOIN invites i ON i.inviter_id = bk.user_id AND i.activity_id = bk.activity_id
  WHERE i.created_at BETWEEN bk.booked_at AND bk.booked_at + interval '7 days'
)
SELECT date_trunc('week', bk.booked_at) AS cohort_week,
       COUNT(*) AS bookers,
       COUNT(inv.user_id) AS inviters,
       ROUND(COUNT(inv.user_id)::numeric / NULLIF(COUNT(*), 0), 4) AS invite_rate
FROM bookers bk LEFT JOIN inviters inv ON inv.user_id = bk.user_id AND inv.activity_id = bk.activity_id
GROUP BY 1 ORDER BY 1;

-- One row per person (anonymous id or user) who opened an invite, with what they saw and what they did next.
CREATE VIEW invite_opens AS
WITH opens AS (
  SELECT e.invite_id, i.rail, i.activity_id, i.inviter_id, i.created_at AS invite_created_at,
         COALESCE(e.anon_id, e.user_id::text) AS opener,
         MIN(e.occurred_at) AS first_open,
         BOOL_OR(COALESCE((e.props->>'spotsLeftAtOpen')::int, 1) = 0) AS saw_full,
         MIN((e.props->>'spotsLeftAtOpen')::int) AS min_spots_left_at_open,
         (ARRAY_AGG(e.platform::text ORDER BY e.occurred_at))[1] AS platform
  FROM events e JOIN invites i ON i.id = e.invite_id
  WHERE e.name = 'invite_opened'
  GROUP BY e.invite_id, i.rail, i.activity_id, i.inviter_id, i.created_at, COALESCE(e.anon_id, e.user_id::text)
)
SELECT o.*,
       EXISTS (SELECT 1 FROM events s WHERE s.name = 'claim_started' AND s.invite_id = o.invite_id AND COALESCE(s.anon_id, s.user_id::text) = o.opener) AS started,
       EXISTS (SELECT 1 FROM events s WHERE s.name = 'claim_submitted' AND s.invite_id = o.invite_id AND COALESCE(s.anon_id, s.user_id::text) = o.opener) AS submitted,
       EXISTS (SELECT 1 FROM events s WHERE s.name = 'claim_rejected' AND s.invite_id = o.invite_id AND COALESCE(s.anon_id, s.user_id::text) = o.opener AND s.props->>'code' = 'INVITE_NOT_FOR_YOU') AS wrong_contact,
       EXISTS (
         SELECT 1 FROM attributions a
         WHERE a.invite_id = o.invite_id
           AND a.created_at BETWEEN o.first_open AND o.first_open + interval '7 days'
           AND (o.rail = 'vouch'
                OR a.invitee_id::text = o.opener
                OR EXISTS (SELECT 1 FROM events c WHERE c.name = 'spot_claimed' AND c.invite_id = o.invite_id AND c.anon_id = o.opener))
       ) AS claimed,
       (SELECT a.invitee_was_new FROM attributions a WHERE a.invite_id = o.invite_id
          AND (o.rail = 'vouch' OR a.invitee_id::text = o.opener OR EXISTS (SELECT 1 FROM events c WHERE c.name = 'spot_claimed' AND c.invite_id = o.invite_id AND c.anon_id = o.opener))
        ORDER BY a.created_at LIMIT 1) AS invitee_was_new
FROM opens o;

-- Goal: invites turn into guests. Unique opens that end in a claim within 7 days, per rail, by week of first open.
CREATE VIEW invite_claim_rate AS
SELECT date_trunc('week', first_open) AS cohort_week, rail,
       COUNT(*) AS opens,
       COUNT(*) FILTER (WHERE claimed) AS claims,
       ROUND(COUNT(*) FILTER (WHERE claimed)::numeric / NULLIF(COUNT(*), 0), 4) AS claim_rate,
       COUNT(*) FILTER (WHERE saw_full) AS opens_on_full
FROM invite_opens
GROUP BY 1, 2 ORDER BY 1, 2;

-- K-factor by rail: new users brought in within 14 days of a booker's first booking, divided by the bookers in that weekly cohort.
CREATE VIEW k_factor_by_rail AS
WITH cohort AS (
  SELECT user_id, MIN(created_at) AS first_booked_at FROM bookings WHERE status = 'confirmed' GROUP BY user_id
), brought AS (
  SELECT c.user_id, a.rail, COUNT(*) FILTER (WHERE a.invitee_was_new) AS new_users
  FROM cohort c JOIN attributions a ON a.inviter_id = c.user_id
   AND a.created_at BETWEEN c.first_booked_at AND c.first_booked_at + interval '14 days'
  GROUP BY c.user_id, a.rail
)
SELECT date_trunc('week', c.first_booked_at) AS cohort_week, r.rail,
       COUNT(DISTINCT c.user_id) AS bookers,
       COALESCE(SUM(b.new_users), 0) AS new_users,
       ROUND(COALESCE(SUM(b.new_users), 0)::numeric / NULLIF(COUNT(DISTINCT c.user_id), 0), 4) AS k_factor
FROM cohort c
CROSS JOIN (VALUES ('vouch'::"Rail"), ('public'::"Rail")) r(rail)
LEFT JOIN brought b ON b.user_id = c.user_id AND b.rail = r.rail
GROUP BY 1, 2 ORDER BY 1, 2;

-- Plans and their size. A plan "happened" as a group if it still had two or more people when the activity started.
CREATE VIEW plan_sizes AS
SELECT p.id AS plan_id, p.activity_id, p.owner_id, a.starts_at,
       COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS members,
       COUNT(b.id) FILTER (WHERE b.status = 'confirmed') >= 2 AS is_group,
       a.starts_at <= now() AS started
FROM plans p JOIN activities a ON a.id = p.activity_id LEFT JOIN bookings b ON b.plan_id = p.id
GROUP BY p.id, a.starts_at;

-- Guests brought in by an invite who booked something else on their own within 30 days.
CREATE VIEW guest_return_30d AS
SELECT a.rail,
       COUNT(DISTINCT a.invitee_id) AS guests,
       COUNT(DISTINCT a.invitee_id) FILTER (WHERE EXISTS (
         SELECT 1 FROM bookings b JOIN invites i ON i.id = a.invite_id
         WHERE b.user_id = a.invitee_id AND b.invite_id IS NULL AND b.status = 'confirmed'
           AND b.activity_id <> i.activity_id
           AND b.created_at BETWEEN a.created_at AND a.created_at + interval '30 days')) AS returned
FROM attributions a
WHERE a.invitee_was_new
GROUP BY a.rail;

-- Treatment against holdout, one row per activity, with host and category so the comparison can be made within them.
CREATE VIEW holdout_comparison AS
WITH first_bookings AS (
  SELECT user_id, MIN(created_at) AS first_at FROM bookings WHERE status = 'confirmed' GROUP BY user_id
)
SELECT v.activity_id, v.variant, v.host_id, v.category, v.starts_at, v.capacity, v.starts_at <= now() AS started,
       (SELECT COUNT(*) FROM bookings b WHERE b.activity_id = v.activity_id AND b.status = 'confirmed') AS confirmed_attendees,
       (SELECT COUNT(*) FROM bookings b JOIN first_bookings f ON f.user_id = b.user_id AND f.first_at = b.created_at
         WHERE b.activity_id = v.activity_id AND b.status = 'confirmed') AS new_users_first_booking,
       (SELECT COUNT(DISTINCT COALESCE(e.anon_id, e.user_id::text)) FROM events e WHERE e.name = 'activity_viewed' AND e.activity_id = v.activity_id) AS unique_views,
       (SELECT COUNT(*) FROM plan_sizes ps WHERE ps.activity_id = v.activity_id AND ps.is_group) AS group_plans
FROM activity_variants v
WHERE v.variant <> 'unknown';

CREATE VIEW holdout_summary AS
SELECT variant,
       COUNT(*) AS activities,
       ROUND(AVG(confirmed_attendees), 2) AS avg_attendees,
       ROUND(AVG(confirmed_attendees::numeric / NULLIF(capacity, 0)), 4) AS avg_fill_rate,
       ROUND(AVG(new_users_first_booking), 2) AS avg_new_users,
       ROUND(SUM(confirmed_attendees)::numeric / NULLIF(SUM(unique_views), 0), 4) AS bookings_per_view,
       ROUND(AVG(group_plans), 2) AS avg_group_plans
FROM holdout_comparison
GROUP BY variant;

-- Goal: never oversell. Any row here is an incident: more confirmed people than capacity, or a counter that drifted from the rows.
CREATE VIEW oversell_check AS
SELECT a.id AS activity_id, a.title, a.capacity, a.spots_taken,
       COUNT(b.id) FILTER (WHERE b.status = 'confirmed') AS confirmed
FROM activities a LEFT JOIN bookings b ON b.activity_id = a.id
GROUP BY a.id
HAVING COUNT(b.id) FILTER (WHERE b.status = 'confirmed') > a.capacity
    OR COUNT(b.id) FILTER (WHERE b.status = 'confirmed') <> a.spots_taken;

-- Goal: bookings succeed when spots exist. Per hour, success over attempts, leaving out correct rejections such as sold out.
CREATE VIEW booking_success_rate AS
SELECT date_trunc('hour', occurred_at) AS hour,
       COUNT(*) FILTER (WHERE name IN ('booking_attempted', 'claim_attempted')) AS attempts,
       COUNT(*) FILTER (WHERE name IN ('booking_succeeded')) AS succeeded,
       COUNT(*) FILTER (WHERE name IN ('booking_rejected', 'claim_rejected')) AS rejected,
       COUNT(*) FILTER (WHERE name IN ('booking_failed', 'claim_failed')) AS failed,
       ROUND(COUNT(*) FILTER (WHERE name IN ('booking_succeeded'))::numeric
             / NULLIF(COUNT(*) FILTER (WHERE name IN ('booking_attempted', 'claim_attempted')) - COUNT(*) FILTER (WHERE name IN ('booking_rejected', 'claim_rejected')), 0), 4) AS success_rate
FROM events
WHERE name IN ('booking_attempted', 'claim_attempted', 'booking_succeeded', 'booking_rejected', 'claim_rejected', 'booking_failed', 'claim_failed')
GROUP BY 1 ORDER BY 1;

-- The invite funnel per open, by platform and by whether the guest was new. Phase 6 diagnostics read this.
CREATE VIEW invite_funnel AS
SELECT rail, platform,
       CASE WHEN invitee_was_new IS NULL THEN 'unknown' WHEN invitee_was_new THEN 'new' ELSE 'existing' END AS guest_kind,
       saw_full,
       COUNT(*) AS opened,
       COUNT(*) FILTER (WHERE started) AS started,
       COUNT(*) FILTER (WHERE submitted) AS submitted,
       COUNT(*) FILTER (WHERE wrong_contact) AS wrong_contact,
       COUNT(*) FILTER (WHERE claimed) AS claimed
FROM invite_opens
GROUP BY 1, 2, 3, 4;
