import { query } from "../config/database.js";

export async function getSchedule(userId, filters = {}) {
  const conditions = ["user_id = $1"];
  const values = [userId];
  let idx = 2;

  if (filters.status) {
    conditions.push(`status = $${idx}`);
    values.push(filters.status);
    idx++;
  }

  const result = await query(
    `SELECT * FROM schedule WHERE ${conditions.join(" AND ")}
     ORDER BY due_date ASC, created_at DESC`,
    values
  );
  return result.rows;
}

export async function getScheduleById(userId, id) {
  const result = await query(
    "SELECT * FROM schedule WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function createSchedule(userId, data) {
  const result = await query(
    `INSERT INTO schedule (user_id, title, type, due_date, reminder_date, priority, status, amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId, data.title, data.type || "work", data.dueDate,
      data.reminderDate || null, data.priority || "Medium",
      data.status || "Pending", data.amount || 0, data.notes || "",
    ]
  );
  return result.rows[0];
}

export async function updateSchedule(userId, id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    title: "title", type: "type", dueDate: "due_date",
    reminderDate: "reminder_date", priority: "priority",
    status: "status", amount: "amount", notes: "notes",
  };

  for (const [key, col] of Object.entries(mapping)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0) return getScheduleById(userId, id);

  fields.push("updated_at = NOW()");
  values.push(id, userId);

  const result = await query(
    `UPDATE schedule SET ${fields.join(", ")}
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteSchedule(userId, id) {
  const result = await query(
    "DELETE FROM schedule WHERE id = $1 AND user_id = $2 RETURNING *",
    [id, userId]
  );
  return result.rows[0] || null;
}
