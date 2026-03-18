import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// db is an alias for pool providing a query helper
const db = {
  query: (text: string, params?: unknown[]) => pool.query(text, params),
};

export { pool, db };
export default pool;
