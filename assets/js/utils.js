/* Shared utilities for Student Budget Tracker */

export function todayKey(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function createTimestamp() {
  return new Date().toISOString();
}

export function emptyRow(colSpan, message) {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = colSpan;
  td.textContent = message;
  tr.append(td);
  return tr;
}

export function createPill(text, className) {
  const pill = document.createElement("span");
  pill.className = `statusPill ${className}`;
  pill.textContent = text;
  return pill;
}

export function statusCssClass(status) {
  switch (status) {
    case "Paid":
    case "Completed":
      return "statusPaid";
    case "Partially Paid":
    case "In Progress":
      return "statusPartial";
    case "Overdue":
      return "statusOverdue";
    default:
      return "statusPending";
  }
}

export function statusLabel(status) {
  switch (status) {
    case "Paid": return "Paid";
    case "Completed": return "Completed";
    case "Partially Paid": return "Partially paid";
    case "In Progress": return "In progress";
    case "Overdue": return "Overdue";
    default: return "Pending";
  }
}

const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

export function debounce(fn, delayMs = 300) {
  let timerId;
  return function debounced(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delayMs);
  };
}
