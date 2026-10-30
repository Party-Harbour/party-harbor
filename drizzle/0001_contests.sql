CREATE TYPE "public"."contest_status" AS ENUM('collecting', 'frozen', 'voting', 'closed', 'revealed');--> statement-breakpoint
CREATE TYPE "public"."self_vote_policy" AS ENUM('allowed', 'disallowed');--> statement-breakpoint
CREATE TYPE "public"."voter_eligibility" AS ENUM('all_invited', 'attending_only');--> statement-breakpoint
CREATE TABLE "contest_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"title" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contest_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"invite_id" uuid,
	"display_name" text NOT NULL,
	"description" text,
	"dietary_tags" text,
	"approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"entry_noun" text DEFAULT 'cookie' NOT NULL,
	"status" "contest_status" DEFAULT 'collecting' NOT NULL,
	"self_vote_policy" "self_vote_policy" DEFAULT 'disallowed' NOT NULL,
	"voter_eligibility" "voter_eligibility" DEFAULT 'all_invited' NOT NULL,
	"ballot_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contests_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"entry_id" uuid NOT NULL,
	"invite_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contest_categories" ADD CONSTRAINT "contest_categories_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_invite_id_event_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."event_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_category_id_contest_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."contest_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_entry_id_contest_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."contest_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_invite_id_event_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."event_invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "votes_category_invite" ON "votes" USING btree ("category_id","invite_id");