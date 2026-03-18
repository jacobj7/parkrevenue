import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        email_verified TIMESTAMPTZ,
        image TEXT,
        password_hash TEXT,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS lots (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        total_spaces INTEGER NOT NULL DEFAULT 0,
        base_price_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        latitude NUMERIC(10, 7),
        longitude NUMERIC(10, 7),
        owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS occupancy_snapshots (
        id SERIAL PRIMARY KEY,
        lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
        occupied_spaces INTEGER NOT NULL DEFAULT 0,
        total_spaces INTEGER NOT NULL DEFAULT 0,
        occupancy_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
        recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_occupancy_snapshots_lot_id
        ON occupancy_snapshots(lot_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_occupancy_snapshots_recorded_at
        ON occupancy_snapshots(recorded_at);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pricing_rules (
        id SERIAL PRIMARY KEY,
        lot_id INTEGER NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
        rule_name VARCHAR(255) NOT NULL,
        rule_type VARCHAR(50) NOT NULL,
        multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.00,
        flat_rate NUMERIC(10, 2),
        min_occupancy_rate NUMERIC(5, 4),
        max_occupancy_rate NUMERIC(5, 4),
        start_time TIME,
        end_time TIME,
        days_of_week INTEGER[],
        priority INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_rules_lot_id
        ON pricing_rules(lot_id);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at'
        ) THEN
          CREATE TRIGGER update_users_updated_at
            BEFORE UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_lots_updated_at'
        ) THEN
          CREATE TRIGGER update_lots_updated_at
            BEFORE UPDATE ON lots
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgname = 'update_pricing_rules_updated_at'
        ) THEN
          CREATE TRIGGER update_pricing_rules_updated_at
            BEFORE UPDATE ON pricing_rules
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END;
      $$;
    `);

    await client.query("COMMIT");

    console.log("Migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolling back:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Unhandled migration error:", error);
  process.exit(1);
});
