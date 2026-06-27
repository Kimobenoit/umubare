import { query } from "../config/database.js";

export async function createSettings(userId) {
  const result = await query(
    `INSERT INTO settings (user_id) VALUES ($1)
     RETURNING *`,
    [userId]
  );
  return result.rows[0];
}

export async function getSettings(userId) {
  const result = await query(
    "SELECT * FROM settings WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] || null;
}

export async function updateSettings(userId, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    usdRate: "usd_rate",
    eurRate: "eur_rate",
    cap: "cap",
    theme: "theme",
    defaultCurrency: "default_currency",
    displayCurrency: "display_currency",
    showWeeklyChart: "show_weekly_chart",
    compactTable: "compact_table",
    confirmBeforeDelete: "confirm_before_delete",
  };

  for (const [key, col] of Object.entries(mapping)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0) return getSettings(userId);

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query(
    `UPDATE settings SET ${fields.join(", ")} WHERE user_id = $${idx}
     RETURNING *`,
    values
  );
  return result.rows[0];
}
