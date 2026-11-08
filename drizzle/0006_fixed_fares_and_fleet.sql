-- Keep the customer-facing fleet aligned with the selected reservation classes.
UPDATE "vehicle_types"
SET "name" = 'Business Sedan', "hourly_rate" = '101.00'
WHERE "category" = 'STANDARD';

UPDATE "vehicle_types"
SET "name" = 'Executive Full-Size SUV', "hourly_rate" = '120.00', "minimum_hours" = 2
WHERE "category" = 'SUV';

UPDATE "vehicle_types"
SET "name" = 'First Class'
WHERE "category" = 'EXECUTIVE';

UPDATE "vehicle_types"
SET "name" = 'Sprinter'
WHERE "category" = 'VAN';

UPDATE "vehicle_types"
SET "is_active" = false
WHERE lower("name") LIKE '%prestige%';

-- Refresh the fixed airport fares and apply them in both travel directions.
UPDATE "route_pricing" rp
SET "flat_price" = CASE
      WHEN rp."route_name" = 'JFK to NYC' AND vt."category" = 'STANDARD' THEN 165.00
      WHEN rp."route_name" = 'JFK to NYC' AND vt."category" = 'SUV' THEN 195.00
      WHEN rp."route_name" = 'JFK to NYC' AND vt."category" IN ('EXECUTIVE', 'LUXURY') THEN 295.00
      WHEN rp."route_name" = 'LGA to NYC' AND vt."category" = 'STANDARD' THEN 140.00
      WHEN rp."route_name" = 'LGA to NYC' AND vt."category" = 'SUV' THEN 165.00
      WHEN rp."route_name" = 'LGA to NYC' AND vt."category" IN ('EXECUTIVE', 'LUXURY') THEN 195.00
      ELSE rp."flat_price"
    END,
    "is_bidirectional" = true
FROM "vehicle_types" vt
WHERE rp."vehicle_type_id" = vt."id"
  AND rp."route_name" IN ('JFK to NYC', 'LGA to NYC')
  AND vt."category" IN ('STANDARD', 'SUV', 'EXECUTIVE', 'LUXURY');
