-- Add minimum_hours column to vehicle_types
ALTER TABLE "vehicle_types" ADD COLUMN IF NOT EXISTS "minimum_hours" integer NOT NULL DEFAULT 2;

-- Create route_pricing table for flat-rate zone pricing
CREATE TABLE IF NOT EXISTS "route_pricing" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "route_name" varchar(150) NOT NULL,
  "origin_keywords" text NOT NULL,
  "destination_keywords" text NOT NULL,
  "vehicle_type_id" bigint NOT NULL REFERENCES "vehicle_types"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "flat_price" numeric(10, 2) NOT NULL,
  "is_bidirectional" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "route_pricing_vehicle_type_id_idx" ON "route_pricing" ("vehicle_type_id");
CREATE INDEX IF NOT EXISTS "route_pricing_is_active_idx" ON "route_pricing" ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "route_pricing_route_vehicle_unique" ON "route_pricing" ("route_name", "vehicle_type_id");

-- ============================================================
-- Seed initial flat-rate route pricing
-- Assumes vehicle_types IDs: 1=STANDARD(Sedan), 2=SUV, 3=LUXURY(Escalade/First Class)
-- Adjust IDs if your vehicle_types table has different IDs.
-- ============================================================

-- Update hourly rates and minimum hours on vehicle_types
UPDATE "vehicle_types" SET "hourly_rate" = '101.00', "minimum_hours" = 2 WHERE "category" = 'STANDARD';
UPDATE "vehicle_types" SET "hourly_rate" = '120.00', "minimum_hours" = 2 WHERE "category" = 'SUV';
UPDATE "vehicle_types" SET "hourly_rate" = '150.00', "minimum_hours" = 2 WHERE "category" = 'LUXURY';

-- JFK to NYC routes
INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'JFK to NYC', 'jfk,kennedy,john f. kennedy', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 165.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'STANDARD'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'JFK to NYC', 'jfk,kennedy,john f. kennedy', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 195.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'SUV'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'JFK to NYC', 'jfk,kennedy,john f. kennedy', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 295.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'LUXURY'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'JFK to NYC', 'jfk,kennedy,john f. kennedy', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 295.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'EXECUTIVE'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

-- LGA to NYC routes
INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'LGA to NYC', 'lga,laguardia,la guardia', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 140.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'STANDARD'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'LGA to NYC', 'lga,laguardia,la guardia', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 165.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'SUV'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'LGA to NYC', 'lga,laguardia,la guardia', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 195.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'LUXURY'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

INSERT INTO "route_pricing" ("route_name", "origin_keywords", "destination_keywords", "vehicle_type_id", "flat_price", "is_bidirectional")
SELECT 'LGA to NYC', 'lga,laguardia,la guardia', 'manhattan,brooklyn,queens,bronx,staten island,new york,nyc,midtown,downtown,uptown,harlem,soho,tribeca,chelsea,wall street,times square,central park', vt.id, 195.00, true
FROM "vehicle_types" vt WHERE vt."category" = 'EXECUTIVE'
ON CONFLICT ("route_name", "vehicle_type_id") DO UPDATE SET "flat_price" = EXCLUDED."flat_price", "origin_keywords" = EXCLUDED."origin_keywords", "destination_keywords" = EXCLUDED."destination_keywords";

