import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Joi from "joi";
import crypto from "crypto";
import config from "../config/env.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import * as authQueries from "../queries/auth.sql.js";
import * as settingsQueries from "../queries/settings.sql.js";
import { AppError, UnauthorizedError } from "../utils/errors.js";

const router = Router();

const registerSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  displayName: Joi.string().max(100).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateTokens(userId) {
  const token = jwt.sign({ sub: userId }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
  const refreshToken = jwt.sign({ sub: userId, type: "refresh" }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
  return { token, refreshToken };
}

// POST /api/auth/register
router.post("/register", authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;

    const existing = await authQueries.findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: true, message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await authQueries.createUser(email, passwordHash, displayName);
    await settingsQueries.createSettings(user.id);

    const { token, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await authQueries.createRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    res.status(201).json({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await authQueries.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: true, message: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: true, message: "Invalid email or password" });
    }

    const { token, refreshToken } = generateTokens(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await authQueries.createRefreshToken(user.id, hashToken(refreshToken), expiresAt);

    res.json({
      token,
      refreshToken,
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post("/refresh", validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokenHash = hashToken(refreshToken);

    let payload;
    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      return res.status(401).json({ error: true, message: "Invalid refresh token" });
    }

    const stored = await authQueries.findRefreshToken(tokenHash);
    if (!stored) {
      return res.status(401).json({ error: true, message: "Refresh token revoked" });
    }

    // Rotate: delete old refresh token, issue new pair
    await authQueries.deleteRefreshToken(tokenHash);

    const newAccessToken = jwt.sign({ sub: payload.sub }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    const newRefreshToken = jwt.sign({ sub: payload.sub, type: "refresh" }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpiresIn });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await authQueries.createRefreshToken(payload.sub, hashToken(newRefreshToken), expiresAt);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post("/logout", validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authQueries.deleteRefreshToken(hashToken(refreshToken));
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — validate token and return current user
router.get("/me", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: true, message: "Not authenticated" });
    }

    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      return res.status(401).json({ error: true, message: "Invalid or expired token" });
    }

    const user = await authQueries.findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ error: true, message: "User not found" });
    }

    res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
  } catch (err) {
    next(err);
  }
});

export default router;
