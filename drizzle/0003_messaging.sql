CREATE TYPE "public"."job_state" AS ENUM('queued', 'sending', 'sent', 'failed', 'dead', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."message_segment" AS ENUM('all_invited', 'pending_rsvp', 'attending', 'not_declined');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('scheduled', 'sending', 'sent', 'cancelled');--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_message_id" text,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_id" uuid,
	"invite_id" uuid,
	"recipient_name" text NOT NULL,
	"to_phone" text,
	"body" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"state" "job_state" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"last_error" text,
	"skip_reason" text,
	"idempotency_key" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"created_by" uuid,
	"label" text NOT NULL,
	"channel" text DEFAULT 'sms' NOT NULL,
	"segment" "message_segment" DEFAULT 'all_invited' NOT NULL,
	"body" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"relative_days" integer,
	"relative_time" text,
	"status" "message_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_invites" ADD COLUMN "token_enc" text;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD CONSTRAINT "message_deliveries_job_id_message_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."message_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_jobs" ADD CONSTRAINT "message_jobs_invite_id_event_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."event_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;