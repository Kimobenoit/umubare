import { formatRwf } from "./budget.js";
import { todayKey, createTimestamp, emptyRow, createPill, statusCssClass, statusLabel } from "./utils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateTime(key) { return new Date(`${key}T00:00:00`).getTime(); }
function daysUntil(key) { return Math.round((dateTime(key) - dateTime(todayKey())) / DAY_MS); }
function effectiveStatus(item) {
  if (item.status === "Completed") return "Completed";
  return daysUntil(item.dueDate) < 0 ? "Overdue" : item.status || "Pending";
}

function typeLabel(type) {
  if (type === "payment") return "Payment";
  if (type === "date") return "Important Date";
  return "Work & Task";
}

function priorityClass(priority) {
  if (priority === "High") return "priorityHigh";
  if (priority === "Low") return "priorityLow";
  return "priorityMedium";
}

function inRange(key, start, end) {
  const value = dateTime(key);
  return value >= dateTime(start) && value <= dateTime(end);
}

function addDays(key, count) {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + count);
  return d.toISOString().slice(0, 10);
}

function monthRange(key) {
  const d = new Date(`${key}T00:00:00`);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function validateScheduleForm(data) {
  if (!data.title || !data.title.trim()) return "Title is required.";
  if (data.title.trim().length > 100) return "Title must be 100 characters or fewer.";
  if (!data.dueDate) return "Due date is required.";
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount < 0) return "Amount must be a positive number.";
  if (data.notes && data.notes.length > 200) return "Notes must be 200 characters or fewer.";
  return null;
}

export function initScheduleFeature({ state, elements, onPersist, apiFn }) {
  const {
    scheduleForm, scheduleTableBody, scheduleCalendarList,
    scheduleAlerts, scheduleMessage, scheduleViewMode,
    scheduleFocusDate, scheduleTotalDue, scheduleOverdueCount,
    scheduleWeekCount, scheduleFinanceTotal
  } = elements;

  function setMessage(text, tone = "") {
    scheduleMessage.textContent = text;
    scheduleMessage.classList.toggle("danger", tone === "danger");
  }

  function getDebtCommitments() {
    return (state.debts?.payables || [])
      .filter((debt) => debt.dueDate && debt.status !== "Paid" && debt.baseStatus !== "Paid")
      .map((debt) => ({
        id: `debt_${debt.id}`,
        title: `Debt payment: ${debt.person}`,
        type: "payment",
        dueDate: debt.dueDate,
        reminderDate: debt.dueDate,
        priority: daysUntil(debt.dueDate) <= 3 ? "High" : "Medium",
        status: daysUntil(debt.dueDate) < 0 ? "Overdue" : "Pending",
        amount: Number(debt.amount || 0),
        notes: debt.notes || "Tracked in Debt Management",
        readonly: true
      }));
  }

  function allItems() {
    return [...state.schedule, ...getDebtCommitments()].sort((a, b) => {
      const dateSort = a.dueDate.localeCompare(b.dueDate);
      if (dateSort !== 0) return dateSort;
      return { High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority];
    });
  }

  function renderDashboard() {
    const items = allItems();
    const open = items.filter((item) => effectiveStatus(item) !== "Completed");
    const overdue = open.filter((item) => effectiveStatus(item) === "Overdue");
    const nextWeek = open.filter((item) => inRange(item.dueDate, todayKey(), addDays(todayKey(), 7)));
    const financeTotal = open.filter((item) => item.type === "payment").reduce((sum, item) => sum + Number(item.amount || 0), 0);

    scheduleTotalDue.textContent = String(open.length);
    scheduleOverdueCount.textContent = String(overdue.length);
    scheduleWeekCount.textContent = String(nextWeek.length);
    scheduleFinanceTotal.textContent = formatRwf(financeTotal);
  }

  function renderAlerts() {
    scheduleAlerts.innerHTML = "";
    const alerts = allItems()
      .filter((item) => {
        const status = effectiveStatus(item);
        const reminderDue = item.reminderDate && daysUntil(item.reminderDate) <= 0;
        return status === "Overdue" || (status !== "Completed" && daysUntil(item.dueDate) <= 3) || reminderDue;
      })
      .slice(0, 6);

    if (alerts.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No urgent reminders right now.";
      scheduleAlerts.append(li);
      return;
    }

    alerts.forEach((item) => {
      const li = document.createElement("li");
      const status = effectiveStatus(item);
      const dueText = status === "Overdue" ? "overdue" : `due in ${daysUntil(item.dueDate)} day(s)`;
      li.append(createPill(typeLabel(item.type), item.type === "payment" ? "statusOverdue" : "statusPartial"));
      li.append(document.createTextNode(` ${item.title} is ${dueText}.`));
      scheduleAlerts.append(li);
    });
  }

  async function updateStatus(id, status) {
    const item = state.schedule.find((entry) => entry.id === id);
    if (!item) return;
    item.status = status;
    item.updatedAt = createTimestamp();
    setMessage("Schedule status updated.");

    if (apiFn) {
      try { await apiFn(`/schedule/${id}`, { method: "PUT", body: { status } }); } catch { /* best effort */ }
    }

    onPersist?.();
    renderAll();
  }

  async function deleteItem(id) {
    const item = state.schedule.find((entry) => entry.id === id);
    if (!item) return;
    if (!confirm(`Delete "${item.title}" from your schedule?`)) return;
    state.schedule = state.schedule.filter((entry) => entry.id !== id);
    setMessage("Schedule item deleted.");

    if (apiFn) {
      try { await apiFn(`/schedule/${id}`, { method: "DELETE" }); } catch { /* best effort */ }
    }

    onPersist?.();
    renderAll();
  }

  function renderTable() {
    scheduleTableBody.innerHTML = "";
    const items = allItems();
    if (items.length === 0) { scheduleTableBody.append(emptyRow(7, "No schedule items yet.")); return; }

    items.forEach((item) => {
      const tr = document.createElement("tr");
      const status = effectiveStatus(item);

      const titleTd = document.createElement("td");
      const title = document.createElement("strong");
      title.textContent = item.title;
      titleTd.append(title);
      if (item.notes) {
        const note = document.createElement("p");
        note.className = "tableNote";
        note.textContent = item.notes;
        titleTd.append(note);
      }

      const typeTd = document.createElement("td");
      typeTd.textContent = typeLabel(item.type);

      const dueTd = document.createElement("td");
      dueTd.textContent = item.dueDate;

      const priorityTd = document.createElement("td");
      priorityTd.append(createPill(item.priority, priorityClass(item.priority)));

      const statusTd = document.createElement("td");
      statusTd.append(createPill(statusLabel(status), statusCssClass(status)));

      const amountTd = document.createElement("td");
      amountTd.textContent = item.type === "payment" && Number(item.amount) > 0 ? formatRwf(Number(item.amount)) : "-";

      const actionTd = document.createElement("td");
      if (item.readonly) {
        actionTd.textContent = "Debt view";
      } else {
        const group = document.createElement("div");
        group.className = "tableButtons";
        const statusSelect = document.createElement("select");
        statusSelect.className = "smallSelect";
        statusSelect.setAttribute("aria-label", `Update status for ${item.title}`);
        ["Pending", "In Progress", "Completed", "Overdue"].forEach((v) => {
          const option = document.createElement("option");
          option.value = v;
          option.textContent = v;
          option.selected = item.status === v;
          statusSelect.append(option);
        });
        statusSelect.addEventListener("change", () => updateStatus(item.id, statusSelect.value));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "smallTableButton delete";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteItem(item.id));
        group.append(statusSelect, deleteButton);
        actionTd.append(group);
      }

      tr.append(titleTd, typeTd, dueTd, priorityTd, statusTd, amountTd, actionTd);
      scheduleTableBody.append(tr);
    });
  }

  function renderCalendar() {
    scheduleCalendarList.innerHTML = "";
    const focus = scheduleFocusDate.value || todayKey();
    let start = focus, end = focus;
    if (scheduleViewMode.value === "weekly") { end = addDays(focus, 6); }
    if (scheduleViewMode.value === "monthly") { const r = monthRange(focus); start = r.start; end = r.end; }

    const visible = allItems().filter((item) => inRange(item.dueDate, start, end));
    if (visible.length === 0) {
      const li = document.createElement("li");
      li.textContent = "No activities or payments in this calendar view.";
      scheduleCalendarList.append(li);
      return;
    }

    visible.forEach((item) => {
      const li = document.createElement("li");
      li.append(createPill(item.dueDate, statusCssClass(effectiveStatus(item))));
      li.append(document.createTextNode(` ${item.title}`));
      scheduleCalendarList.append(li);
    });
  }

  async function addScheduleItem(formData) {
    const error = validateScheduleForm(formData);
    if (error) { setMessage(error, "danger"); return false; }

    const ts = createTimestamp();
    const localItem = {
      id: `sch_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      title: formData.title.trim(),
      type: formData.type,
      dueDate: formData.dueDate,
      reminderDate: formData.reminderDate || "",
      priority: formData.priority,
      status: formData.status,
      amount: Number(formData.amount || 0),
      notes: (formData.notes || "").trim(),
      createdAt: ts,
      updatedAt: ts
    };

    state.schedule.unshift(localItem);

    if (apiFn) {
      try {
        const res = await apiFn("/schedule", {
          method: "POST",
          body: {
            title: formData.title.trim(),
            type: formData.type,
            dueDate: formData.dueDate,
            reminderDate: formData.reminderDate || null,
            priority: formData.priority,
            status: formData.status,
            amount: Number(formData.amount || 0),
            notes: (formData.notes || "").trim()
          }
        });
        if (res?.item) {
          const idx = state.schedule.findIndex((s) => s.id === localItem.id);
          if (idx !== -1) state.schedule[idx] = { ...state.schedule[idx], ...res.item };
        }
      } catch { /* server sync failed, local state preserved */ }
    }

    setMessage("Schedule item added.");
    return true;
  }

  function bindEvents() {
    scheduleForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fd = new FormData(scheduleForm);
      const saved = await addScheduleItem({
        title: fd.get("title") || "", type: fd.get("type") || "work",
        dueDate: fd.get("dueDate") || "", reminderDate: fd.get("reminderDate") || "",
        priority: fd.get("priority") || "Medium", status: fd.get("status") || "Pending",
        amount: fd.get("amount") || "0", notes: fd.get("notes") || ""
      });
      if (!saved) return;
      scheduleForm.reset();
      onPersist?.();
      renderAll();
    });

    scheduleViewMode?.addEventListener("change", renderCalendar);
    scheduleFocusDate?.addEventListener("change", renderCalendar);
  }

  function renderAll() { renderDashboard(); renderAlerts(); renderTable(); renderCalendar(); }

  if (scheduleFocusDate && !scheduleFocusDate.value) scheduleFocusDate.value = todayKey();
  renderAll();
  bindEvents();
  return { renderAll };
}
