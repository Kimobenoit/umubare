import "dotenv/config";

const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET", "REFRESH_SECRET"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshSecret: process.env.REFRESH_SECRET,
    refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || "7d",
  },
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  rateLimit: {
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  apiMax: Number(process.env.RATE_LIMIT_MAX || 100),
  authMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 5),
  skipApiSuccess: true,
  skipAuthSuccess: false,
}
};

export default config;
console.log(process.env.RATE_LIMIT_SKIP_SUCCESS);