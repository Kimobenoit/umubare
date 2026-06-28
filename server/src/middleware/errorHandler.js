import config from "../config/env.js";

// export function errorHandler(err, req, res, _next) {
//   const statusCode = err.statusCode || 500;
//   const message = err.isOperational ? err.message : "Internal server error";

//   if (statusCode >= 500) {
//     console.error("Server error:", {
//       message: err.message,
//       stack: err.stack,
//       path: req.path,
//       method: req.method,
//     });
//   }

//   res.status(statusCode).json({
//     error: true,
//     message,
//     ...(config.env === "development" && statusCode >= 500 && { stack: err.stack }),
//   });
// }
export function errorHandler(err, req, res, next) {
  console.error("🔥 ERROR CAUGHT:", err); // IMPORTANT

  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message,
    stack: err.stack // TEMPORARY for debugging
  });
}