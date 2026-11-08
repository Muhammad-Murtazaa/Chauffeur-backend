ALTER TABLE "bookings" ALTER COLUMN "customer_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "guest_access_token_hash" varchar(64);
