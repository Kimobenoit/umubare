import { query } from "../config/database.js";

export async function getDebts(userId, type = null) {
  if (type) {
    const result = await query(
      "SELECT * FROM debts WHERE user_id = $1 AND type = $2 ORDER BY created_at DESC",
      [userId, type]
    );
    return result.rows;
  }
  const result = await query(
    "SELECT * FROM debts WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows;
}

export async function getDebtById(userId, id) {
  const result = await query(
    "SELECT * FROM debts WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function createDebt(userId, data) {
  const result = await query(
    `INSERT INTO debts (user_id, type, person, amount, due_date, status, base_status, notes, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      userId, data.type, data.person, data.amount, data.dueDate,
      data.status || "Pending", data.baseStatus || data.status || "Pending",
      data.notes || "", data.paidAt || null,
    ]
  );
  return result.rows[0];
}

export async function updateDebt(userId, id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  const mapping = {
    person: "person", amount: "amount", dueDate: "due_date",
    status: "status", baseStatus: "base_status", notes: "notes", paidAt: "paid_at",
  };

  for (const [key, col] of Object.entries(mapping)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0) return getDebtById(userId, id);

  fields.push("updated_at = NOW()");
  values.push(id, userId);

  const result = await query(
    `UPDATE debts SET ${fields.join(", ")}
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING *`,
    values
  );
  return result.rows[0] || null;
}

export async function deleteDebt(userId, id) {
  const result = await query(
    "DELETE FROM debts WHERE id = $1 AND user_id = $2 RETURNING *",
    [id, userId]
  );
  return result.rows[0] || null;
}

export async function getDebtHistory(userId) {
  const result = await query(
    "SELECT * FROM debt_history WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows;
}

export async function addDebtHistory(userId, data) {
  const result = await query(
    `INSERT INTO debt_history (user_id, debt_id, date, type_label, person, action, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, data.debtId || null, data.date, data.typeLabel, data.person, data.action, data.status]
  );
  return result.rows[0];
}
