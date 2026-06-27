import { formatRwf } from "./budget.js";
import { todayKey, createTimestamp, emptyRow, createPill, statusCssClass, statusLabel } from "./utils.js";

function dueStatus(dueDate, status) {
  if (status === "Paid") return "Paid";
  if (!dueDate) return status || "Pending";
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const now = new Date(`${todayKey()}T00:00:00`).getTime();
  if (due < now && status !== "Paid") return "Overdue";
  return status || "Pending";
}

function computeReliabilityScore(debts) {
  const all = [...(debts.receivables || []), ...(debts.payables || [])];
  if (all.length === 0) return 0;

  let considered = 0;
  let onTime = 0;

  for (const debt of all) {
    if (!debt.dueDate) continue;
    considered++;
    const base = debt.baseStatus || debt.status;
    const finalStatus = dueStatus(debt.dueDate, base);
    if (finalStatus === "Paid") {
      const due = new Date(`${debt.dueDate}T00:00:00`).getTime();
      const paidAt = debt.paidAt ? new Date(`${debt.paidAt}T00:00:00`).getTime() : null;
      const nowPaid = paidAt ?? new Date(`${todayKey()}T00:00:00`).getTime();
      const isOnTime = paidAt ? nowPaid <= due : finalStatus !== "Overdue";
      if (isOnTime) onTime++;
    }
  }

  const onTimeRate = considered > 0 ? onTime / considered : 0;
  const overdueOpen = all.filter((d) => dueStatus(d.dueDate, d.baseStatus || d.status) === "Overdue").length;
  const paidCount = all.filter((d) => dueStatus(d.dueDate, d.baseStatus || d.status) === "Paid").length;
  const latePenalty = all.length > 0 ? overdueOpen / all.length : 0;
  const repaymentBoost = all.length > 0 ? paidCount / all.length : 0;

  return Math.round(
    Math.max(0, Math.min(100, 100 * (0.65 * onTimeRate + 0.25 * repaymentBoost - 0.35 * latePenalty)))
  );
}

function computeTotals(debts) {
  const receivables = debts.receivables || [];
  const payables = debts.payables || [];
  const totalReceivables = receivables.reduce((s, d) => s + Number(d.amount || 0), 0);
  const totalPayables = payables.reduce((s, d) => s + Number(d.amount || 0), 0);

  const overdueCount = [...receivables, ...payables].filter(
    (d) => dueStatus(d.dueDate, d.baseStatus || d.status) === "Overdue"
  ).length;

  const nowMs = new Date(`${todayKey()}T00:00:00`).getTime();
  const in7Ms = nowMs + 7 * 24 * 60 * 60 * 1000;
  const upcomingCount = [...receivables, ...payables].filter((d) => {
    if (!d.dueDate) return false;
    const due = new Date(`${d.dueDate}T00:00:00`).getTime();
    const final = dueStatus(d.dueDate, d.baseStatus || d.status);
    if (final === "Paid") return false;
    return due >= nowMs && due <= in7Ms;
  }).length;

  return { totalReceivables, totalPayables, overdueCount, upcomingCount };
}

function createDebtRow(debt, type, onDelete) {
  const tr = document.createElement("tr");
  const status = dueStatus(debt.dueDate, debt.baseStatus || debt.status);

  const personCell = document.createElement("td");
  personCell.textContent = debt.person || "";

  const amountCell = document.createElement("td");
  amountCell.textContent = formatRwf(Number(debt.amount || 0));

  const dueCell = document.createElement("td");
  dueCell.textContent = debt.dueDate || "\u2014";

  const statusTd = document.createElement("td");
  statusTd.append(createPill(statusLabel(status), statusCssClass(status)));

  const actionTd = document.createElement("td");
  const group = document.createElement("div");
  group.className = "tableButtons";
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "smallTableButton delete";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => onDelete(debt.id, type));
  group.append(deleteBtn);
  actionTd.append(group);

  tr.append(personCell, amountCell, dueCell, statusTd, actionTd);
  tr.dataset.debtId = debt.id;
  tr.dataset.debtType = type;
  return tr;
}

export function initDebtFeature({ state, stateDebtsKey, elements, onPersist, apiFn }) {
  const {
    receivableTableBody, payableTableBody, debtHistoryBody,
    debtMessage, debtReceivableForm, debtPayableForm,
    debtScoreValue, debtScoreBar, debtReliabilityText,
  } = elements;

  function getDebts() { return state.debts; }

  function setMessage(text, tone = "") {
    debtMessage.textContent = text;
    debtMessage.classList.toggle("danger", tone === "danger");
  }

  function persistHistory(entry) {
    const debts = getDebts();
    if (!debts.history) debts.history = [];
    debts.history.unshift(entry);
  }

  function makeHistoryEntry(type, person, action, status) {
    return {
      id: `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: todayKey(),
      typeLabel: type === "receivable" ? "Receivable" : "Payable",
      person,
      action,
      status
    };
  }

  function validateDebtForm(formData) {
    if (!formData.person || !formData.person.trim()) return "Person is required.";
    if (formData.person.trim().length > 100) return "Person name must be 100 characters or fewer.";
    const amount = Number(formData.amount);
    if (!Number.isFinite(amount) || amount <= 0) return "Amount must be greater than 0.";
    if (!formData.dueDate) return "Due date is required.";
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(formData.dueDate)) return "Due date must use YYYY-MM-DD format.";
    if (formData.notes && formData.notes.length > 200) return "Notes must be 200 characters or fewer.";
    return null;
  }

  async function addDebt(formData, type) {
    const debts = getDebts();
    const list = type === "receivable" ? debts.receivables : debts.payables;
    const amount = Number(formData.amount);
    const baseStatus = formData.status || "Pending";
    const finalStatus = dueStatus(formData.dueDate, baseStatus);
    const ts = createTimestamp();

    const localDebt = {
      id: `debt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      person: formData.person.trim(),
      amount,
      dueDate: formData.dueDate,
      status: finalStatus,
      baseStatus,
      notes: (formData.notes || "").trim(),
      createdAt: ts,
      updatedAt: ts,
      paidAt: baseStatus === "Paid" ? todayKey() : null,
      payments: []
    };

    list.unshift(localDebt);
    persistHistory(makeHistoryEntry(type, formData.person.trim(), "Added", finalStatus));

    if (apiFn) {
      try {
        const res = await apiFn("/debts", {
          method: "POST",
          body: { type, person: formData.person.trim(), amount, dueDate: formData.dueDate, status: baseStatus, notes: (formData.notes || "").trim() }
        });
        if (res?.debt) {
          const idx = list.findIndex((d) => d.id === localDebt.id);
          if (idx !== -1) list[idx] = { ...list[idx], ...res.debt };
        }
      } catch { /* server sync failed, local state preserved */ }
    }

    setMessage(type === "receivable" ? "Receivable added." : "Payable added.");
  }

  async function deleteDebt(id, type) {
    const debts = getDebts();
    const list = type === "receivable" ? debts.receivables : debts.payables;
    const idx = list.findIndex((d) => d.id === id);
    if (idx === -1) return;
    const debt = list[idx];
    if (!confirm(`Delete this debt for "${debt.person}"?`)) return;
    list.splice(idx, 1);
    persistHistory(makeHistoryEntry(type, debt.person, "Deleted", dueStatus(debt.dueDate, debt.baseStatus || debt.status)));
    setMessage("Debt deleted.");

    if (apiFn) {
      try { await apiFn(`/debts/${id}`, { method: "DELETE" }); } catch { /* best effort */ }
    }

    onPersist?.();
    renderAll();
  }

  function handleFormSubmit(e, form, type) {
    e.preventDefault();
    setMessage("");
    const fd = new FormData(form);
    const data = { person: fd.get("person"), amount: fd.get("amount"), dueDate: fd.get("dueDate"), status: fd.get("status"), notes: fd.get("notes") };
    const error = validateDebtForm(data);
    if (error) { setMessage(error, "danger"); return; }
    addDebt(data, type);
    form.reset();
    onPersist?.();
    renderAll();
  }

  function renderTables() {
    const debts = getDebts();
    const types = [
      { list: debts.receivables || [], body: receivableTableBody, type: "receivable", empty: "No receivables recorded yet." },
      { list: debts.payables || [], body: payableTableBody, type: "payable", empty: "No payables recorded yet." }
    ];
    for (const { list, body, type, empty } of types) {
      body.innerHTML = "";
      if (list.length === 0) {
        body.append(emptyRow(5, empty));
      } else {
        list.forEach((d) => body.append(createDebtRow(d, type, (id) => deleteDebt(id, type))));
      }
    }
  }

  function renderDashboard() {
    const totals = computeTotals(getDebts());
    elements.debtReceivableTotal.textContent = formatRwf(totals.totalReceivables);
    elements.debtPayableTotal.textContent = formatRwf(totals.totalPayables);
    elements.debtOverdueTotal.textContent = String(totals.overdueCount);
    elements.debtUpcomingTotal.textContent = String(totals.upcomingCount);

    const score = computeReliabilityScore(getDebts());
    debtScoreValue.textContent = `${score}%`;
    if (debtScoreBar) debtScoreBar.style.width = `${score}%`;
    if (debtReliabilityText) {
      const label = score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : score >= 30 ? "Needs work" : "Poor";
      debtReliabilityText.textContent = `Reliability: ${label}`;
    }
  }

  function renderHistory() {
    debtHistoryBody.innerHTML = "";
    const history = getDebts().history || [];
    if (history.length === 0) {
      debtHistoryBody.append(emptyRow(5, "No debt history yet."));
      return;
    }
    history.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.append(
        Object.assign(document.createElement("td"), { textContent: entry.date }),
        Object.assign(document.createElement("td"), { textContent: entry.typeLabel }),
        Object.assign(document.createElement("td"), { textContent: entry.person }),
        Object.assign(document.createElement("td"), { textContent: entry.action }),
        (() => { const td = document.createElement("td"); td.append(createPill(statusLabel(entry.status), statusCssClass(entry.status))); return td; })()
      );
      debtHistoryBody.prepend(tr);
    });
  }

  function renderAll() { renderTables(); renderHistory(); renderDashboard(); }

  if (debtReceivableForm) debtReceivableForm.addEventListener("submit", (e) => handleFormSubmit(e, debtReceivableForm, "receivable"));
  if (debtPayableForm) debtPayableForm.addEventListener("submit", (e) => handleFormSubmit(e, debtPayableForm, "payable"));

  renderAll();
  return { renderAll };
}
