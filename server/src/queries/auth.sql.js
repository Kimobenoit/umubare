import { query } from "../config/database.js";

export async function createUser(email, passwordHash, displayName = "Student") {
  const result = await query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, $3)
     RETURNING id, email, display_name, created_at`,
    [email, passwordHash, displayName]
  );
  return result.rows[0];
}

export async function findUserByEmail(email) {
  const result = await query(
    "SELECT id, email, password_hash, display_name FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
}

export async function findUserById(id) {
  const result = await query(
    "SELECT id, email, display_name FROM users WHERE id = $1",
    [id]
  );
  return result.rows[0] || null;
}

export async function createRefreshToken(userId, tokenHash, expiresAt) {
  await query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );
}

export async function findRefreshToken(tokenHash) {
  const result = await query(
    `SELECT id, user_id, expires_at FROM refresh_tokens
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

export async function deleteRefreshToken(tokenHash) {
  await query("DELETE FROM refresh_tokens WHERE token_hash = $1", [tokenHash]);
}

export async function deleteUserRefreshTokens(userId) {
  await query("DELETE FROM refresh_tokens WHERE user_id = $1", [userId]);
}
