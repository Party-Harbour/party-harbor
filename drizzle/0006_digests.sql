CREATE TYPE "public"."digest_frequency" AS ENUM('off', 'daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."digest_status" AS ENUM('ready', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_key" text NOT NULL,
	"trigger" text DEFAULT 'scheduled' NOT NULL,
	"since" timestamp with time zone,
	"summary" jsonb NOT NULL,
	"body" text NOT NULL,
	"status" "digest_status" DEFAULT 'ready' NOT NULL,
	"to_phone" text,
	"provider_message_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_e164" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'America/New_York' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_frequency" "digest_frequency" DEFAULT 'daily' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_hour" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "digest_weekday" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "digests" ADD CONSTRAINT "digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digests_user_period" ON "digests" USING btree ("user_id","period_key");