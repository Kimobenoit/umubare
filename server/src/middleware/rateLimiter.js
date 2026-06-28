import rateLimit from "express-rate-limit";
import config from "../config/env.js";

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.apiMax,
  skipSuccessfulRequests: config.rateLimit.skipApiSuccess,
  message: { error: true, message: "Too many requests, please try again later." },
});

export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  skipSuccessfulRequests: config.rateLimit.skipAuthSuccess,
  message: { error: true, message: "Too many login attempts, please try again later." },
});

console.log(process.env.RATE_LIMIT_SKIP_SUCCESS);