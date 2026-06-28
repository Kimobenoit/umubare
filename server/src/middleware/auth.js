import jwt from "jsonwebtoken";
import config from "../config/env.js";
import { UnauthorizedError } from "../utils/errors.js";

export function authenticate(req, _res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(new UnauthorizedError("Missing or invalid authorization header"));
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.userId = payload.sub;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Token expired"));
    }
    return next(new UnauthorizedError("Invalid token"));
  }
  app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(req.method, req.url, res.statusCode);
  });
  next();
});
}
