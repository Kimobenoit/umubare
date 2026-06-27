import { Router } from "express";
import Joi from "joi";
import { validate } from "../middleware/validate.js";
import * as settingsQueries from "../queries/settings.sql.js";

const router = Router();

const settingsSchema = Joi.object({
  usdRate: Joi.number().positive(),
  eurRate: Joi.number().positive(),
  cap: Joi.number().min(0),
  theme: Joi.string().valid("light", "dark"),
  defaultCurrency: Joi.string().valid("RWF", "USD", "EUR"),
  displayCurrency: Joi.string().valid("RWF", "USD", "EUR"),
  showWeeklyChart: Joi.boolean(),
  compactTable: Joi.boolean(),
  confirmBeforeDelete: Joi.boolean(),
}).min(1);

// GET /api/settings
router.get("/", async (req, res, next) => {
  try {
    let settings = await settingsQueries.getSettings(req.userId);
    if (!settings) {
      settings = await settingsQueries.createSettings(req.userId);
    }
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put("/", validate(settingsSchema), async (req, res, next) => {
  try {
    const settings = await settingsQueries.updateSettings(req.userId, req.body);
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

export default router;
