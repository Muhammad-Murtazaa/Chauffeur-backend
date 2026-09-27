CREATE TYPE "public"."assignment_status" AS ENUM('ASSIGNED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('PENDING_PAYMENT', 'CONFIRMED', 'DRIVER_ASSIGNMENT_PENDING', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PAYMENT_FAILED');--> statement-breakpoint
CREATE TYPE "public"."booking_type" AS ENUM('ONE_WAY', 'RETURN', 'HOURLY', 'CITY_TO_CITY');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('STRIPE', 'MOCK', 'CASH', 'SQUARE');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('SCHEDULED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');--> statement-breakpoint
CREATE TYPE "public"."stop_type" AS ENUM('PICKUP', 'STOP', 'DROPOFF');--> statement-breakpoint
CREATE TABLE "booking_assignments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"booking_id" bigint NOT NULL,
	"driver_id" bigint NOT NULL,
	"vehicle_id" bigint,
	"status" "assignment_status" DEFAULT 'ASSIGNED' NOT NULL,
	"assigned_by" bigint,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"booking_id" bigint NOT NULL,
	"old_status" "booking_status",
	"new_status" "booking_status" NOT NULL,
	"changed_by_user_id" bigint,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_stops" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"booking_id" bigint NOT NULL,
	"type" "stop_type" DEFAULT 'STOP' NOT NULL,
	"place_id" varchar(255),
	"address" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"sequence" integer DEFAULT 0 NOT NULL,
	"estimated_arrival" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"customer_id" bigint NOT NULL,
	"quote_id" bigint,
	"booking_type" "booking_type" DEFAULT 'ONE_WAY' NOT NULL,
	"vehicle_type_id" bigint NOT NULL,
	"pickup_at" timestamp with time zone NOT NULL,
	"passenger_count" integer DEFAULT 1 NOT NULL,
	"luggage_count" integer DEFAULT 0 NOT NULL,
	"passenger_name" varchar(150) NOT NULL,
	"passenger_phone" varchar(50) NOT NULL,
	"passenger_email" varchar(255) NOT NULL,
	"flight_number" varchar(50),
	"special_instructions" text,
	"distance_meters" integer DEFAULT 0 NOT NULL,
	"estimated_duration_seconds" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"surcharges" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"booking_status" "booking_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"cancelled_by" varchar(50),
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"cancellation_fee" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"booking_id" bigint NOT NULL,
	"provider" "payment_provider" DEFAULT 'STRIPE' NOT NULL,
	"provider_payment_id" varchar(255),
	"provider_session_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"paid_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_vehicle_options" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"quote_id" bigint NOT NULL,
	"vehicle_type_id" bigint NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"name" varchar(100) NOT NULL,
	"base_price" numeric(10, 2) NOT NULL,
	"distance_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"duration_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"surcharges" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"extras" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"tax" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint,
	"booking_type" "booking_type" DEFAULT 'ONE_WAY' NOT NULL,
	"pickup_address" text NOT NULL,
	"pickup_place_id" varchar(255),
	"pickup_lat" numeric(10, 7),
	"pickup_lng" numeric(10, 7),
	"dropoff_address" text,
	"dropoff_place_id" varchar(255),
	"dropoff_lat" numeric(10, 7),
	"dropoff_lng" numeric(10, 7),
	"distance_meters" integer DEFAULT 0 NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"pickup_at" timestamp with time zone NOT NULL,
	"passenger_count" integer DEFAULT 1 NOT NULL,
	"luggage_count" integer DEFAULT 0 NOT NULL,
	"hours" integer DEFAULT 0,
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rides" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"booking_id" bigint NOT NULL,
	"driver_id" bigint NOT NULL,
	"vehicle_id" bigint,
	"en_route_at" timestamp with time zone,
	"arrived_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"actual_distance_meters" integer,
	"actual_duration_seconds" integer,
	"status" "ride_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_types" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"category" "vehicle_category" NOT NULL,
	"name" varchar(100) NOT NULL,
	"passenger_capacity" integer NOT NULL,
	"luggage_capacity" integer DEFAULT 0 NOT NULL,
	"base_fare" numeric(10, 2) NOT NULL,
	"price_per_distance" numeric(10, 2) NOT NULL,
	"price_per_minute" numeric(10, 2) NOT NULL,
	"minimum_fare" numeric(10, 2) NOT NULL,
	"hourly_rate" numeric(10, 2) DEFAULT '100.00' NOT NULL,
	"image_url" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_assignments" ADD CONSTRAINT "booking_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "booking_stops" ADD CONSTRAINT "booking_stops_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_vehicle_options" ADD CONSTRAINT "quote_vehicle_options_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quote_vehicle_options" ADD CONSTRAINT "quote_vehicle_options_vehicle_type_id_vehicle_types_id_fk" FOREIGN KEY ("vehicle_type_id") REFERENCES "public"."vehicle_types"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "rides" ADD CONSTRAINT "rides_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "booking_assignments_booking_id_idx" ON "booking_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_assignments_driver_id_idx" ON "booking_assignments" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "booking_assignments_status_idx" ON "booking_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_status_history_booking_id_idx" ON "booking_status_history" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_status_history_created_at_idx" ON "booking_status_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "booking_stops_booking_id_idx" ON "booking_stops" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_stops_sequence_idx" ON "booking_stops" USING btree ("booking_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_reference_number_unique" ON "bookings" USING btree ("reference_number");--> statement-breakpoint
CREATE INDEX "bookings_customer_id_idx" ON "bookings" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("booking_status");--> statement-breakpoint
CREATE INDEX "bookings_payment_status_idx" ON "bookings" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "bookings_pickup_at_idx" ON "bookings" USING btree ("pickup_at");--> statement-breakpoint
CREATE INDEX "payments_booking_id_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_provider_payment_id_idx" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quote_vehicle_options_quote_id_idx" ON "quote_vehicle_options" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quotes_customer_id_idx" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "quotes_expires_at_idx" ON "quotes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rides_booking_id_idx" ON "rides" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "rides_driver_id_idx" ON "rides" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "rides_status_idx" ON "rides" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_types_category_unique" ON "vehicle_types" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vehicle_types_is_active_idx" ON "vehicle_types" USING btree ("is_active");