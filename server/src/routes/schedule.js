import { Router } from "express";
import Joi from "joi";
import { validate } from "../middleware/validate.js";
import * as scheduleQueries from "../queries/schedule.sql.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

const scheduleSchema = Joi.object({
  title: Joi.string().max(100).required(),
  type: Joi.string().valid("work", "payment", "date").default("work"),
  dueDate: Joi.date().iso().required(),
  reminderDate: Joi.date().iso().allow(null, ""),
  priority: Joi.string().valid("High", "Medium", "Low").default("Medium"),
  status: Joi.string().valid("Pending", "In Progress", "Completed", "Overdue").default("Pending"),
  amount: Joi.number().min(0).default(0),
  notes: Joi.string().max(200).allow("").default(""),
});

const updateScheduleSchema = Joi.object({
  title: Joi.string().max(100),
  type: Joi.string().valid("work", "payment", "date"),
  dueDate: Joi.date().iso(),
  reminderDate: Joi.date().iso().allow(null, ""),
  priority: Joi.string().valid("High", "Medium", "Low"),
  status: Joi.string().valid("Pending", "In Progress", "Completed", "Overdue"),
  amount: Joi.number().min(0),
  notes: Joi.string().max(200).allow(""),
}).min(1);

// GET /api/schedule
router.get("/", async (req, res, next) => {
  try {
    const schedule = await scheduleQueries.getSchedule(req.userId, req.query);
    res.json({ schedule });
  } catch (err) {
    next(err);
  }
});

// POST /api/schedule
router.post("/", validate(scheduleSchema), async (req, res, next) => {
  try {
    const item = await scheduleQueries.createSchedule(req.userId, req.body);
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

// PUT /api/schedule/:id
router.put("/:id", validate(updateScheduleSchema), async (req, res, next) => {
  try {
    const existing = await scheduleQueries.getScheduleById(req.userId, req.params.id);
    if (!existing) throw new NotFoundError("Schedule item");

    const updated = await scheduleQueries.updateSchedule(req.userId, req.params.id, req.body);
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/schedule/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await scheduleQueries.deleteSchedule(req.userId, req.params.id);
    if (!deleted) throw new NotFoundError("Schedule item");
    res.json({ message: "Schedule item deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
