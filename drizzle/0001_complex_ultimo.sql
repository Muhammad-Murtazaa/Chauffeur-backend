ALTER TABLE "users" ADD COLUMN "first_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" DROP COLUMN "first_name";--> statement-breakpoint
ALTER TABLE "drivers" DROP COLUMN "last_name";