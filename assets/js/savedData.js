import { validateCategory, validateDate, validateDescription, validateAmount, patterns } from "./formChecks.js";

export function buildExportData(records, settings, debts, schedule = []) {
  return {
    app: "Student Budget Tracker",
    version: 3,
    exportedAt: new Date().toISOString(),
    settings,
    records,
    debts,
    schedule
  };
}

export function validateImportData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, message: "Imported JSON must be an object." };
  }

  if (!Array.isArray(data.records)) {
    return { valid: false, message: "Imported JSON must include a records array." };
  }

  const settings = validateSettings(data.settings || {});
  if (!settings.valid) return settings;

  const seenIds = new Set();
  const records = [];
  for (const [index, record] of data.records.entries()) {
    const result = validateImportedRecord(record, seenIds);
    if (!result.valid) return { valid: false, message: `Record ${index + 1}: ${result.message}` };
    records.push(result.record);
  }

  const debts = validateImportedDebts(data.debts);
  if (!debts.valid) return debts;

  const schedule = validateImportedSchedule(data.schedule);
  if (!schedule.valid) return schedule;

  return { valid: true, data: { records, settings: settings.settings, debts: debts.debts, schedule: schedule.schedule } };
}

function validateImportedSchedule(schedule) {
  if (schedule === undefined) return { valid: true, schedule: [] };
  if (!Array.isArray(schedule)) return { valid: false, message: "Schedule must be an array." };

  const normalized = [];
  const allowedTypes = ["work", "payment", "date"];
  const allowedPriorities = ["High", "Medium", "Low"];
  const allowedStatuses = ["Pending", "In Progress", "Completed", "Overdue"];

  for (const item of schedule) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const id = String(item.id ?? "");
    const title = String(item.title ?? "").trim();
    const type = validateChoice(item.type, allowedTypes, "work");
    const priority = validateChoice(item.priority, allowedPriorities, "Medium");
    const status = validateChoice(item.status, allowedStatuses, "Pending");
    const dueDate = String(item.dueDate ?? "");
    const reminderDate = item.reminderDate ? String(item.reminderDate) : "";
    const amount = Number(item.amount ?? 0);

    if (!id || !title) continue;
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dueDate)) continue;
    if (reminderDate && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(reminderDate)) continue;
    if (!Number.isFinite(amount) || amount < 0) continue;

    normalized.push({ id, title, type, dueDate, reminderDate, priority, status, amount, notes: String(item.notes ?? ""), createdAt: String(item.createdAt ?? new Date().toISOString()), updatedAt: String(item.updatedAt ?? new Date().toISOString()) });
  }
  return { valid: true, schedule: normalized };
}

function validateImportedDebts(debts) {
  if (debts === undefined) return { valid: true, debts: { receivables: [], payables: [], history: [] } };
  if (!debts || typeof debts !== "object" || Array.isArray(debts)) return { valid: false, message: "Debts must be an object." };

  const receivables = Array.isArray(debts.receivables) ? debts.receivables : [];
  const payables = Array.isArray(debts.payables) ? debts.payables : [];
  const history = Array.isArray(debts.history) ? debts.history : [];

  const normalizeDebt = (d) => {
    if (!d || typeof d !== "object" || Array.isArray(d)) return null;
    const id = String(d.id ?? "");
    if (!id) return null;
    const person = String(d.person ?? "").trim();
    const amount = Number(d.amount ?? 0);
    const dueDate = d.dueDate ? String(d.dueDate) : "";
    const status = d.status ? String(d.status) : "Pending";
    const baseStatus = d.baseStatus ? String(d.baseStatus) : status;
    if (!person || !Number.isFinite(amount) || amount < 0) return null;
    if (dueDate && !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dueDate)) return null;
    return { id, person, amount, dueDate: dueDate || null, status, baseStatus, notes: String(d.notes ?? ""), createdAt: String(d.createdAt ?? new Date().toISOString()), updatedAt: String(d.updatedAt ?? new Date().toISOString()), paidAt: d.paidAt ? String(d.paidAt) : null, payments: Array.isArray(d.payments) ? d.payments : [] };
  };

  const normalizedReceivables = receivables.map(normalizeDebt).filter(Boolean);
  const normalizedPayables = payables.map(normalizeDebt).filter(Boolean);
  const normalizedHistory = history.filter((h) => h && typeof h === "object").map((h) => ({ id: String(h.id ?? ""), date: String(h.date ?? ""), typeLabel: String(h.typeLabel ?? ""), person: String(h.person ?? ""), action: String(h.action ?? ""), status: String(h.status ?? "Pending") })).filter((h) => h.id);

  return { valid: true, debts: { receivables: normalizedReceivables, payables: normalizedPayables, history: normalizedHistory } };
}

function validateSettings(settings) {
  const usdRate = Number(settings.usdRate ?? 1300);
  const eurRate = Number(settings.eurRate ?? 1450);
  const cap = Number(settings.cap ?? 0);
  const theme = validateChoice(settings.theme, ["light", "dark"], "light");
  const defaultCurrency = validateChoice(settings.defaultCurrency, ["RWF", "USD", "EUR"], "RWF");
  const displayCurrency = validateChoice(settings.displayCurrency, ["RWF", "USD", "EUR"], "RWF");
  const showWeeklyChart = typeof settings.showWeeklyChart === "boolean" ? settings.showWeeklyChart : true;
  const compactTable = typeof settings.compactTable === "boolean" ? settings.compactTable : false;
  const confirmBeforeDelete = typeof settings.confirmBeforeDelete === "boolean" ? settings.confirmBeforeDelete : true;

  if (!Number.isFinite(usdRate) || usdRate <= 0) return { valid: false, message: "Settings must include a positive USD rate." };
  if (!Number.isFinite(cap) || cap < 0) return { valid: false, message: "Settings cap must be zero or a positive number." };
  if (!Number.isFinite(eurRate) || eurRate <= 0) return { valid: false, message: "Settings must include a positive EUR rate." };

  return { valid: true, settings: { usdRate, eurRate, cap, theme, defaultCurrency, displayCurrency, showWeeklyChart, compactTable, confirmBeforeDelete } };
}

function validateChoice(value, allowedValues, fallback) {
  return allowedValues.includes(value) ? value : fallback;
}

function validateImportedRecord(record, seenIds) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return { valid: false, message: "Record must be an object." };
  if (typeof record.id !== "string" || !/^txn_\d+$/.test(record.id)) return { valid: false, message: "Record id must look like txn_0001." };
  if (seenIds.has(record.id)) return { valid: false, message: "Record ids must be unique." };
  seenIds.add(record.id);

  const description = validateDescription(String(record.description ?? ""));
  const amount = validateImportedAmount(record.amount);
  const category = validateCategory(String(record.category ?? ""));
  const date = validateDate(String(record.date ?? ""));
  const currency = validateCurrency(record.currency);
  const createdAt = validateTimestamp(record.createdAt, "createdAt");
  const updatedAt = validateTimestamp(record.updatedAt, "updatedAt");

  const checks = [description, amount, category, date, currency, createdAt, updatedAt];
  const failed = checks.find((check) => !check.valid);
  if (failed) return { valid: false, message: failed.message };

  return { valid: true, record: { id: record.id, description: description.value, amount: amount.value, category: category.value, date: date.value, currency: currency.value, createdAt: createdAt.value, updatedAt: updatedAt.value } };
}

function validateImportedAmount(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return { valid: false, message: "Amount must be a zero or positive number." };
  if (!patterns.amount.test(String(value))) return { valid: false, message: "Amount must use no more than two decimal places." };
  return { valid: true, value, message: "" };
}

function validateCurrency(value) {
  if (value !== "RWF" && value !== "USD" && value !== "EUR") return { valid: false, message: "Currency must be RWF, USD, or EUR." };
  return { valid: true, value, message: "" };
}

function validateTimestamp(value, fieldName) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return { valid: false, message: `${fieldName} must be a valid timestamp.` };
  return { valid: true, value, message: "" };
}
