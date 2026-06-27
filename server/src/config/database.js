import pg from "pg";
import config from "./env.js";

const pool = new pg.Pool({
  host: config.db.host,
  port: config.db.port,
  database: config.db.name,
  user: config.db.user,
  password: config.db.password,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: config.db.host !== "localhost" ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (config.env === "development") {
    console.log("  query", { text: text.slice(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }
  return result;
}

export async function getClient() {
  return pool.connect();
}

export async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    return { ok: true, time: result.rows[0].now };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export default pool;
