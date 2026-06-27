import { Router } from "express";
import Joi from "joi";
import { validate } from "../middleware/validate.js";
import * as debtsQueries from "../queries/debts.sql.js";
import { NotFoundError } from "../utils/errors.js";

const router = Router();

const debtSchema = Joi.object({
  type: Joi.string().valid("receivable", "payable").required(),
  person: Joi.string().max(100).required(),
  amount: Joi.number().positive().required(),
  dueDate: Joi.date().iso().required(),
  status: Joi.string().valid("Pending", "Partially Paid", "Paid", "Overdue").default("Pending"),
  notes: Joi.string().max(200).allow("").default(""),
});

const updateDebtSchema = Joi.object({
  person: Joi.string().max(100),
  amount: Joi.number().positive(),
  dueDate: Joi.date().iso(),
  status: Joi.string().valid("Pending", "Partially Paid", "Paid", "Overdue"),
  baseStatus: Joi.string().valid("Pending", "Partially Paid", "Paid", "Overdue"),
  notes: Joi.string().max(200).allow(""),
  paidAt: Joi.date().iso().allow(null),
}).min(1);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dueStatus(dueDate, status) {
  if (status === "Paid") return "Paid";
  if (!dueDate) return status || "Pending";
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const now = new Date(`${todayKey()}T00:00:00`).getTime();
  if (due < now && status !== "Paid") return "Overdue";
  return status || "Pending";
}

// GET /api/debts
router.get("/", async (req, res, next) => {
  try {
    const debts = await debtsQueries.getDebts(req.userId, req.query.type);
    const receivables = debts.filter((d) => d.type === "receivable");
    const payables = debts.filter((d) => d.type === "payable");
    res.json({ receivables, payables });
  } catch (err) {
    next(err);
  }
});

// GET /api/debts/history
router.get("/history", async (req, res, next) => {
  try {
    const history = await debtsQueries.getDebtHistory(req.userId);
    res.json({ history });
  } catch (err) {
    next(err);
  }
});

// POST /api/debts
router.post("/", validate(debtSchema), async (req, res, next) => {
  try {
    const { type, person, amount, dueDate, status, notes } = req.body;
    const finalStatus = dueStatus(dueDate, status);

    const debt = await debtsQueries.createDebt(req.userId, {
      type, person, amount, dueDate,
      status: finalStatus,
      baseStatus: status,
      notes,
      paidAt: status === "Paid" ? todayKey() : null,
    });

    await debtsQueries.addDebtHistory(req.userId, {
      date: todayKey(),
      typeLabel: type === "receivable" ? "Receivable" : "Payable",
      person,
      action: "Added",
      status: finalStatus,
    });

    res.status(201).json({ debt });
  } catch (err) {
    next(err);
  }
});

// PUT /api/debts/:id
router.put("/:id", validate(updateDebtSchema), async (req, res, next) => {
  try {
    const existing = await debtsQueries.getDebtById(req.userId, req.params.id);
    if (!existing) throw new NotFoundError("Debt");

    const updated = await debtsQueries.updateDebt(req.userId, req.params.id, req.body);
    res.json({ debt: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/debts/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await debtsQueries.deleteDebt(req.userId, req.params.id);
    if (!deleted) throw new NotFoundError("Debt");

    await debtsQueries.addDebtHistory(req.userId, {
      date: todayKey(),
      typeLabel: deleted.type === "receivable" ? "Receivable" : "Payable",
      person: deleted.person,
      action: "Deleted",
      status: deleted.status,
    });

    res.json({ message: "Debt deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;
