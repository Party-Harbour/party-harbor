CREATE TYPE "public"."gallery_policy" AS ENUM('hidden', 'view', 'contribute');--> statement-breakpoint
CREATE TYPE "public"."photo_state" AS ENUM('pending', 'visible', 'hidden');--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"invite_id" uuid,
	"uploaded_by" uuid,
	"contest_entry_id" uuid,
	"storage_key" text NOT NULL,
	"thumb_key" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"caption" text,
	"state" "photo_state" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "gallery_policy" "gallery_policy" DEFAULT 'contribute' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "gallery_auto_approve" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_invite_id_event_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."event_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_contest_entry_id_contest_entries_id_fk" FOREIGN KEY ("contest_entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_cover_photo_id_photos_id_fk" FOREIGN KEY ("cover_photo_id") REFERENCES "public"."photos"("id") ON DELETE set null ON UPDATE no action;