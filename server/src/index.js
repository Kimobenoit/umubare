import express from "express";
import helmet from "helmet";
import cors from "cors";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import config from "./config/env.js";
import { testConnection } from "./config/database.js";
import { authenticate } from "./middleware/auth.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { AppError } from "./utils/errors.js";

import authRoutes from "./routes/auth.js";
import recordsRoutes from "./routes/records.js";
import settingsRoutes from "./routes/settings.js";
import debtsRoutes from "./routes/debts.js";
import scheduleRoutes from "./routes/schedule.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || config.port || 3000;

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
const allowedOrigins = (config.clientOrigin || "http://localhost").split(",").map((s) => s.trim());

const capacitorOrigins = [
  "capacitor://localhost",
  "ionic://localhost",
  "https://localhost",
  "http://localhost",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || capacitorOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: "1mb" }));

// Rate limiting
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: config.env });
});

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/records", authenticate, recordsRoutes);
app.use("/api/settings", authenticate, settingsRoutes);
app.use("/api/debts", authenticate, debtsRoutes);
app.use("/api/schedule", authenticate, scheduleRoutes);

// Serve static client files
const clientPath = join(__dirname, "../../dist");

app.use(express.static(clientPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(join(clientPath, "index.html"));
});

// 404 for unknown API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({ error: true, message: "Endpoint not found" });
});

// Error handler
app.use(errorHandler);

// Start server
async function start() {
  const dbStatus = await testConnection();
  if (!dbStatus.ok) {
    console.error("Database connection failed:", dbStatus.error);
    console.error("Please ensure PostgreSQL is running and the database is created.");
    process.exit(1);
  }
  console.log("Database connected:", dbStatus.time);

  app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${config.env}]`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
