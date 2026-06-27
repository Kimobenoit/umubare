import { Router } from "express";
import Joi from "joi";
import { validate } from "../middleware/validate.js";
import * as recordsQueries from "../queries/records.sql.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

const recordSchema = Joi.object({
  description: Joi.string().max(100).required(),
  amount: Joi.number().min(0).required(),
  category: Joi.string().max(50).required(),
  date: Joi.date().iso().required(),
  currency: Joi.string().valid("RWF", "USD", "EUR").default("RWF"),
});

const updateSchema = Joi.object({
  description: Joi.string().max(100),
  amount: Joi.number().min(0),
  category: Joi.string().max(50),
  date: Joi.date().iso(),
  currency: Joi.string().valid("RWF", "USD", "EUR"),
}).min(1);

const importSchema = Joi.object({
  records: Joi.array().items(recordSchema).min(1).max(1000).required(),
});

// GET /api/records
router.get("/", async (req, res, next) => {
  try {
    const { sort, search, limit, offset } = req.query;
    const result = await recordsQueries.getRecords(req.userId, {
      sort,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/records/:id
router.get("/:id", async (req, res, next) => {
  try {
    const record = await recordsQueries.getRecordById(req.userId, req.params.id);
    if (!record) throw new NotFoundError("Record");
    res.json({ record });
  } catch (err) {
    next(err);
  }
});

// POST /api/records
router.post("/", validate(recordSchema), async (req, res, next) => {
  try {
    const record = await recordsQueries.createRecord(req.userId, req.body);
    res.status(201).json({ record });
  } catch (err) {
    next(err);
  }
});

// PUT /api/records/:id
router.put("/:id", validate(updateSchema), async (req, res, next) => {
  try {
    const record = await recordsQueries.updateRecord(req.userId, req.params.id, req.body);
    if (!record) throw new NotFoundError("Record");
    res.json({ record });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/records/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await recordsQueries.deleteRecord(req.userId, req.params.id);
    if (!deleted) throw new NotFoundError("Record");
    res.json({ message: "Record deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/records/import
router.post("/import", validate(importSchema), async (req, res, next) => {
  try {
    const imported = await recordsQueries.importRecords(req.userId, req.body.records);
    res.status(201).json({ imported });
  } catch (err) {
    next(err);
  }
});

export default router;
