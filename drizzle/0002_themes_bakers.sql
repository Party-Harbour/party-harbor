CREATE TYPE "public"."event_theme" AS ENUM('coastal', 'sunset', 'celebration', 'earth');--> statement-breakpoint
ALTER TABLE "contests" ADD COLUMN "show_bakers" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "theme" "event_theme" DEFAULT 'coastal' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "cover_image_url" text;