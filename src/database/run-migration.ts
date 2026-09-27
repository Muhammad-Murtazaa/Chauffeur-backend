import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function run() {
  console.log('Connecting to Neon DB...');
  const sqlFilePath = path.join(__dirname, '../../drizzle/0002_complete_bedlam.sql');
  const sqlContent = fs.readFileSync(sqlFilePath, 'utf-8');

  // Split on statement-breakpoint
  const statements = sqlContent
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  console.log(`Executing ${statements.length} migration statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await pool.query(stmt);
      console.log(`[${i + 1}/${statements.length}] Applied statement`);
    } catch (err: any) {
      if (err.message.includes('already exists')) {
        console.log(`[${i + 1}/${statements.length}] Notice: object already exists, continuing...`);
      } else {
        console.error(`[${i + 1}/${statements.length}] Error:`, err.message);
      }
    }
  }

  // Seed default vehicle types if not present
  console.log('Seeding default vehicle types...');
  const defaultVehicleTypes = [
    {
      category: 'STANDARD',
      name: 'Business Class Sedan',
      passengerCapacity: 3,
      luggageCapacity: 2,
      baseFare: 65.00,
      pricePerDistance: 3.20,
      pricePerMinute: 0.85,
      minimumFare: 75.00,
      hourlyRate: 95.00,
      description: 'Mercedes E-Class, BMW 5 Series, or Audi A6 with professional chauffeur.',
      imageUrl: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=800&q=80',
    },
    {
      category: 'EXECUTIVE',
      name: 'First Class Executive',
      passengerCapacity: 3,
      luggageCapacity: 3,
      baseFare: 95.00,
      pricePerDistance: 4.50,
      pricePerMinute: 1.10,
      minimumFare: 110.00,
      hourlyRate: 135.00,
      description: 'Mercedes S-Class, BMW 7 Series, or Audi A8 L with bespoke amenities.',
      imageUrl: 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80',
    },
    {
      category: 'LUXURY',
      name: 'Prestige Luxury Sedan',
      passengerCapacity: 4,
      luggageCapacity: 3,
      baseFare: 140.00,
      pricePerDistance: 6.00,
      pricePerMinute: 1.50,
      minimumFare: 160.00,
      hourlyRate: 185.00,
      description: 'Maybach S680 or Bentley Flying Spur with VIP white-glove service.',
      imageUrl: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80',
    },
    {
      category: 'SUV',
      name: 'Executive Full-Size SUV',
      passengerCapacity: 6,
      luggageCapacity: 6,
      baseFare: 110.00,
      pricePerDistance: 4.80,
      pricePerMinute: 1.20,
      minimumFare: 130.00,
      hourlyRate: 150.00,
      description: 'Cadillac Escalade ESV, Lincoln Navigator, or Chevrolet Suburban.',
      imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
    },
    {
      category: 'VAN',
      name: 'VIP Sprinter Lounge Van',
      passengerCapacity: 12,
      luggageCapacity: 12,
      baseFare: 180.00,
      pricePerDistance: 7.00,
      pricePerMinute: 1.80,
      minimumFare: 220.00,
      hourlyRate: 240.00,
      description: 'Mercedes-Benz Sprinter Executive Lounge with WiFi, entertainment, and conference seating.',
      imageUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=800&q=80',
    },
  ];

  for (const vt of defaultVehicleTypes) {
    try {
      await pool.query(
        `INSERT INTO vehicle_types (category, name, passenger_capacity, luggage_capacity, base_fare, price_per_distance, price_per_minute, minimum_fare, hourly_rate, description, image_url, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
         ON CONFLICT (category) DO UPDATE SET
           name = EXCLUDED.name,
           passenger_capacity = EXCLUDED.passenger_capacity,
           luggage_capacity = EXCLUDED.luggage_capacity,
           base_fare = EXCLUDED.base_fare,
           price_per_distance = EXCLUDED.price_per_distance,
           price_per_minute = EXCLUDED.price_per_minute,
           minimum_fare = EXCLUDED.minimum_fare,
           hourly_rate = EXCLUDED.hourly_rate,
           description = EXCLUDED.description,
           image_url = EXCLUDED.image_url;`,
        [
          vt.category,
          vt.name,
          vt.passengerCapacity,
          vt.luggageCapacity,
          vt.baseFare,
          vt.pricePerDistance,
          vt.pricePerMinute,
          vt.minimumFare,
          vt.hourlyRate,
          vt.description,
          vt.imageUrl,
        ]
      );
      console.log(`Seeded vehicle type: ${vt.name} (${vt.category})`);
    } catch (err: any) {
      console.error(`Error seeding ${vt.category}:`, err.message);
    }
  }

  await pool.end();
  console.log('Migration & seeding finished successfully!');
}

run().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
