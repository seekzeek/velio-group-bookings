-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('outdoors', 'nights_out', 'food_and_drink', 'classes', 'other');

-- CreateEnum
CREATE TYPE "Illustration" AS ENUM ('kayak', 'hike', 'speakeasy', 'salsa', 'market', 'pottery', 'other');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "Rail" AS ENUM ('vouch', 'public');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('web', 'mobile');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "contact_hmac" TEXT,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "remind_day_before" BOOLEAN NOT NULL DEFAULT true,
    "friend_updates" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "illustration" "Illustration" NOT NULL,
    "location" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "spots_taken" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_photos" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'confirmed',
    "invite_id" UUID,
    "idempotency_key" TEXT NOT NULL,
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "rail" "Rail" NOT NULL,
    "inviter_id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "plan_id" UUID,
    "recipient_hmac" TEXT,
    "recipient_label" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_revocations" (
    "id" UUID NOT NULL,
    "invite_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_revocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributions" (
    "id" UUID NOT NULL,
    "invite_id" UUID NOT NULL,
    "rail" "Rail" NOT NULL,
    "code" TEXT NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "invitee_was_new" BOOLEAN NOT NULL,
    "hop_generation" INTEGER NOT NULL,
    "plan_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID,
    "anon_id" TEXT,
    "platform" "Platform",
    "activity_id" UUID,
    "invite_id" UUID,
    "rail" "Rail",
    "props" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flag_exposures" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "anon_id" TEXT,
    "activity_id" UUID NOT NULL,
    "flag" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flag_exposures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spot_watches" (
    "id" UUID NOT NULL,
    "activity_id" UUID NOT NULL,
    "user_id" UUID,
    "anon_id" TEXT,
    "contact_hmac" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spot_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rollout_percent" INTEGER NOT NULL DEFAULT 100,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_contact_hmac_key" ON "users"("contact_hmac");

-- CreateIndex
CREATE INDEX "activities_starts_at_idx" ON "activities"("starts_at");

-- CreateIndex
CREATE INDEX "activities_host_id_idx" ON "activities"("host_id");

-- CreateIndex
CREATE INDEX "activity_photos_activity_id_position_idx" ON "activity_photos"("activity_id", "position");

-- CreateIndex
CREATE INDEX "plans_activity_id_idx" ON "plans"("activity_id");

-- CreateIndex
CREATE INDEX "plans_owner_id_idx" ON "plans"("owner_id");

-- CreateIndex
CREATE INDEX "bookings_activity_id_status_idx" ON "bookings"("activity_id", "status");

-- CreateIndex
CREATE INDEX "bookings_plan_id_idx" ON "bookings"("plan_id");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_user_id_idempotency_key_key" ON "bookings"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_inviter_id_activity_id_idx" ON "invites"("inviter_id", "activity_id");

-- CreateIndex
CREATE INDEX "invites_activity_id_idx" ON "invites"("activity_id");

-- CreateIndex
CREATE INDEX "invite_revocations_invite_id_idx" ON "invite_revocations"("invite_id");

-- CreateIndex
CREATE UNIQUE INDEX "attributions_booking_id_key" ON "attributions"("booking_id");

-- CreateIndex
CREATE INDEX "attributions_invite_id_idx" ON "attributions"("invite_id");

-- CreateIndex
CREATE INDEX "attributions_inviter_id_idx" ON "attributions"("inviter_id");

-- CreateIndex
CREATE INDEX "attributions_invitee_id_idx" ON "attributions"("invitee_id");

-- CreateIndex
CREATE INDEX "events_name_occurred_at_idx" ON "events"("name", "occurred_at");

-- CreateIndex
CREATE INDEX "events_invite_id_idx" ON "events"("invite_id");

-- CreateIndex
CREATE INDEX "events_activity_id_idx" ON "events"("activity_id");

-- CreateIndex
CREATE INDEX "flag_exposures_activity_id_flag_idx" ON "flag_exposures"("activity_id", "flag");

-- CreateIndex
CREATE INDEX "spot_watches_activity_id_idx" ON "spot_watches"("activity_id");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_photos" ADD CONSTRAINT "activity_photos_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_revocations" ADD CONSTRAINT "invite_revocations_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_invitee_id_fkey" FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributions" ADD CONSTRAINT "attributions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_exposures" ADD CONSTRAINT "flag_exposures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flag_exposures" ADD CONSTRAINT "flag_exposures_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spot_watches" ADD CONSTRAINT "spot_watches_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spot_watches" ADD CONSTRAINT "spot_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written below this line. Prisma's schema language can't express these.

-- Inventory guards. The booking module's conditional UPDATE is the primary guard; these make the database refuse an oversold row even if the code is wrong.
ALTER TABLE "activities" ADD CONSTRAINT "activities_capacity_positive" CHECK ("capacity" >= 1);
ALTER TABLE "activities" ADD CONSTRAINT "activities_spots_within_capacity" CHECK ("spots_taken" BETWEEN 0 AND "capacity");

-- One confirmed spot per person per activity. Cancelled rows don't count, so someone who cancelled can book again.
CREATE UNIQUE INDEX "bookings_one_confirmed_per_user" ON "bookings" ("activity_id", "user_id") WHERE "status" = 'confirmed';

-- A vouch can only ever be claimed once, even by two racing claims.
CREATE UNIQUE INDEX "attributions_one_per_vouch" ON "attributions" ("invite_id") WHERE "rail" = 'vouch';

-- One exposure per viewer per activity per flag, for signed-in users and for anonymous guests.
CREATE UNIQUE INDEX "flag_exposures_user_once" ON "flag_exposures" ("user_id", "activity_id", "flag") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "flag_exposures_anon_once" ON "flag_exposures" ("anon_id", "activity_id", "flag") WHERE "anon_id" IS NOT NULL;

-- One watch per viewer per activity.
CREATE UNIQUE INDEX "spot_watches_user_once" ON "spot_watches" ("user_id", "activity_id") WHERE "user_id" IS NOT NULL;
CREATE UNIQUE INDEX "spot_watches_anon_once" ON "spot_watches" ("anon_id", "activity_id") WHERE "anon_id" IS NOT NULL;

-- Append-only history. Revocations and claims are new rows; nothing in these tables is ever rewritten.
CREATE OR REPLACE FUNCTION reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'P0001';
END
$$;

CREATE TRIGGER "invites_append_only" BEFORE UPDATE OR DELETE ON "invites" FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER "invite_revocations_append_only" BEFORE UPDATE OR DELETE ON "invite_revocations" FOR EACH ROW EXECUTE FUNCTION reject_change();
CREATE TRIGGER "attributions_append_only" BEFORE UPDATE OR DELETE ON "attributions" FOR EACH ROW EXECUTE FUNCTION reject_change();

-- The invite kill switch and rollout live in a row, so flipping them needs no deploy.
INSERT INTO "feature_flags" ("key", "enabled", "rollout_percent") VALUES ('invites', true, 100);
