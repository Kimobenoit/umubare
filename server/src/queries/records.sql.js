import { query } from "../config/database.js";

export async function getRecords(userId, { sort = "date-desc", search = "", limit = 200, offset = 0 } = {}) {
  const conditions = ["user_id = $1"];
  const values = [userId];
  let idx = 2;

  if (search) {
    conditions.push(`(description ILIKE $${idx} OR category ILIKE $${idx})`);
    values.push(`%${search}%`);
    idx++;
  }

  const where = conditions.join(" AND ");

  const sortMap = {
    "date-desc": "date DESC, created_at DESC",
    "date-asc": "date ASC, created_at ASC",
    "description-asc": "description ASC",
    "description-desc": "description DESC",
    "amount-asc": "amount ASC",
    "amount-desc": "amount DESC",
  };
  const orderBy = sortMap[sort] || "date DESC, created_at DESC";

  values.push(limit, offset);

  const result = await query(
    `SELECT * FROM records WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    values
  );

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM records WHERE ${where}`,
    values.slice(0, idx - 1)
  );

  return { records: result.rows, total: countResult.rows[0].total };
}

export async function getRecordById(userId, id) {
  const result = await query(
    "SELECT * FROM records WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function createRecord(userId, data) {
  const result = await query(
    `INSERT INTO records (user_id, description, amount, category, date, currency)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, data.description, data.amount, data.category, data.date, data.currency]
  );
  return result.rows[0];
}

export async function updateRecord(userId, id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const [key, col] of [["description", "description"], ["amount", "amount"], ["category", "category"], ["date", "date"], ["currency", "currency"]]) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0) return getRecordById(userId, id);

  fields.push("updated_at = NOW()");
  values.push(id, userId);

  const result = await query(
    `UPDATE records SET ${fields.join(", ")}
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteRecord(userId, id) {
  const result = await query(
    "DELETE FROM records WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function importRecords(userId, records) {
  const { getClient } = await import("../config/database.js");
  const client = await getClient();
  let imported = 0;
  try {
    await client.query("BEGIN");
    for (const rec of records) {
      const existing = await client.query(
        `SELECT id FROM records WHERE user_id = $1 AND description = $2 AND date = $3 LIMIT 1`,
        [userId, rec.description, rec.date]
      );
      if (existing.rows.length > 0) continue;
      await client.query(
        `INSERT INTO records (user_id, description, amount, category, date, currency)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, rec.description, rec.amount, rec.category, rec.date, rec.currency || "RWF"]
      );
      imported++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return imported;
}
