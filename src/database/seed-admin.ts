import { Pool } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcryptjs';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function seedAdmin() {
  console.log('Seeding Admin User...');
  const adminEmail = 'admin@vipchauffeur.com';
  const adminPassword = 'Admin@VIP2026!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const query = `
    INSERT INTO users (first_name, last_name, email, phone, password_hash, role, email_verified, phone_verified, is_active)
    VALUES ($1, $2, $3, $4, $5, 'ADMIN', true, true, true)
    ON CONFLICT (email) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = EXCLUDED.phone,
      password_hash = EXCLUDED.password_hash,
      role = 'ADMIN',
      email_verified = true,
      phone_verified = true,
      is_active = true,
      updated_at = NOW()
    RETURNING id, email, role, first_name, last_name;
  `;

  try {
    const res = await pool.query(query, [
      'Executive',
      'Admin',
      adminEmail,
      '+13478889799',
      passwordHash,
    ]);
    console.log('Admin user seeded successfully:', res.rows[0]);
  } catch (err: any) {
    console.error('Error seeding admin user:', err.message);
  } finally {
    await pool.end();
  }
}

seedAdmin();
