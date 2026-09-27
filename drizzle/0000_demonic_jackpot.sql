CREATE TYPE "public"."document_verification_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."driver_availability_status" AS ENUM('OFFLINE', 'AVAILABLE', 'BUSY', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."driver_document_type" AS ENUM('DRIVING_LICENSE', 'IDENTITY_DOCUMENT', 'BACKGROUND_CHECK', 'WORK_PERMIT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."driver_verification_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."photo_verification_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('CUSTOMER', 'DRIVER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."vehicle_category" AS ENUM('STANDARD', 'EXECUTIVE', 'LUXURY', 'SUV', 'VAN');--> statement-breakpoint
CREATE TYPE "public"."vehicle_document_type" AS ENUM('REGISTRATION', 'INSURANCE', 'INSPECTION_CERTIFICATE', 'COMMERCIAL_LICENSE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."vehicle_photo_type" AS ENUM('FRONT', 'BACK', 'LEFT', 'RIGHT', 'INTERIOR', 'LICENSE_PLATE');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."verification_entity_type" AS ENUM('DRIVER', 'VEHICLE', 'DOCUMENT');--> statement-breakpoint
CREATE TABLE "driver_documents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"driver_id" bigint NOT NULL,
	"document_type" "driver_document_type" NOT NULL,
	"document_number" varchar(150),
	"front_image_url" text,
	"back_image_url" text,
	"issue_date" date,
	"expiry_date" date,
	"status" "document_verification_status" DEFAULT 'PENDING' NOT NULL,
	"verified_by" bigint,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"profile_image_url" text,
	"date_of_birth" date,
	"address" text,
	"city" varchar(100),
	"years_of_experience" integer DEFAULT 0 NOT NULL,
	"emergency_contact_name" varchar(150),
	"emergency_contact_phone" varchar(30),
	"verification_status" "driver_verification_status" DEFAULT 'PENDING' NOT NULL,
	"status" "driver_status" DEFAULT 'PENDING' NOT NULL,
	"availability_status" "driver_availability_status" DEFAULT 'OFFLINE' NOT NULL,
	"verified_by" bigint,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'CUSTOMER' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"phone_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_documents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"document_type" "vehicle_document_type" NOT NULL,
	"document_number" varchar(150),
	"file_url" text NOT NULL,
	"issue_date" date,
	"expiry_date" date,
	"status" "document_verification_status" DEFAULT 'PENDING' NOT NULL,
	"verified_by" bigint,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_photos" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"vehicle_id" bigint NOT NULL,
	"photo_type" "vehicle_photo_type" NOT NULL,
	"image_url" text NOT NULL,
	"status" "photo_verification_status" DEFAULT 'PENDING' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"driver_id" bigint NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"year" integer NOT NULL,
	"color" varchar(50) NOT NULL,
	"registration_number" varchar(100) NOT NULL,
	"vin_number" varchar(100),
	"category" "vehicle_category" NOT NULL,
	"passenger_capacity" integer NOT NULL,
	"luggage_capacity" integer DEFAULT 0 NOT NULL,
	"status" "vehicle_status" DEFAULT 'PENDING' NOT NULL,
	"verified_by" bigint,
	"verified_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"entity_type" "verification_entity_type" NOT NULL,
	"entity_id" bigint NOT NULL,
	"old_status" varchar(30),
	"new_status" varchar(30) NOT NULL,
	"reviewed_by" bigint,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vehicle_documents" ADD CONSTRAINT "vehicle_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vehicle_photos" ADD CONSTRAINT "vehicle_photos_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "verification_history" ADD CONSTRAINT "verification_history_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "driver_documents_driver_id_idx" ON "driver_documents" USING btree ("driver_id");--> statement-breakpoint
CREATE INDEX "driver_documents_status_idx" ON "driver_documents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "driver_documents_driver_type_unique" ON "driver_documents" USING btree ("driver_id","document_type");--> statement-breakpoint
CREATE UNIQUE INDEX "drivers_user_id_unique" ON "drivers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "drivers_status_idx" ON "drivers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "drivers_verification_status_idx" ON "drivers" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "drivers_availability_status_idx" ON "drivers" USING btree ("availability_status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "vehicle_documents_vehicle_id_idx" ON "vehicle_documents" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX "vehicle_documents_status_idx" ON "vehicle_documents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_documents_vehicle_type_unique" ON "vehicle_documents" USING btree ("vehicle_id","document_type");--> statement-breakpoint
CREATE INDEX "vehicle_photos_vehicle_id_idx" ON "vehicle_photos" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_photos_vehicle_type_unique" ON "vehicle_photos" USING btree ("vehicle_id","photo_type");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_driver_id_unique" ON "vehicles" USING btree ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_registration_number_unique" ON "vehicles" USING btree ("registration_number");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicles_vin_number_unique" ON "vehicles" USING btree ("vin_number");--> statement-breakpoint
CREATE INDEX "vehicles_status_idx" ON "vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vehicles_category_idx" ON "vehicles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "verification_history_entity_idx" ON "verification_history" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "verification_history_reviewed_by_idx" ON "verification_history" USING btree ("reviewed_by");