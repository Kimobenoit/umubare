import { api, isAuthenticated, clearTokens } from "./api.js";
import { renderAuthView, logout as authLogout, getCurrentUser, bootstrapAuth } from "./auth.js";
import { validateTransaction } from "./formChecks.js";
import {
  addRecordLocal,
  deleteRecordLocal,
  defaultSettings,
  replaceDebts,
  replaceRecords,
  replaceSchedule,
  state,
  updateRecordLocal,
  updateSettings as saveBudgetSettings
} from "./expenses.js";
import { initDebtFeature } from "./debt.js";
import { initScheduleFeature } from "./schedule.js";
import { compileRegex, highlightedFragment, recordMatches } from "./searchTools.js";
import { calculateStats, formatRwf, getLastSevenDays } from "./budget.js";
import { buildExportData, validateImportData } from "./savedData.js";
import { debounce, escapeHtml } from "./utils.js";

const appLayout = document.querySelector(".appLayout");
const authContainer = document.querySelector("#authContainer") || createAuthContainer();
const expenseForm = document.querySelector(".expenseForm");
const formMessage = document.querySelector("#formMessage");
const expenseTableBody = document.querySelector("#expenseTableBody");
const expenseSearch = document.querySelector("#expenseSearch");
const searchError = document.querySelector("#searchError");
const ignoreCaseCheck = document.querySelector("#ignoreCase");
const sortExpenses = document.querySelector("#sortExpenses");
const addExpenseButton = expenseForm?.querySelector("#addExpenseButton");
const expenseCurrencySelect = document.querySelector("#expenseCurrency");
const usdRateInput = document.querySelector("#usdRate");
const eurRateInput = document.querySelector("#eurRate");
const monthlyBudgetInput = document.querySelector("#monthlyBudget");
const defaultCurrencySelect = document.querySelector("#defaultCurrency");
const displayCurrencySelect = document.querySelector("#displayCurrency");
const themeToggle = document.querySelector("#themeToggle");
const showWeeklyChartCheck = document.querySelector("#showWeeklyChart");
const compactTableCheck = document.querySelector("#compactTable");
const confirmBeforeDeleteCheck = document.querySelector("#confirmBeforeDelete");
const totalTransactions = document.querySelector("#totalTransactions");
const totalExpenses = document.querySelector("#totalExpenses");
const mainCategory = document.querySelector("#mainCategory");
const remainingBalance = document.querySelector("#remainingBalance");
const budgetMessage = document.querySelector("#budgetMessage");
const chartBox = document.querySelector(".chartBox");
const weeklyChart = document.querySelector("#weeklyChart");
const weeklySummary = document.querySelector("#weeklySummary");
const settingsMessage = document.querySelector("#settingsMessage");
const downloadJsonButton = document.querySelector("#downloadJsonButton");
const jsonFile = document.querySelector("#jsonFile");
const uploadJsonButton = document.querySelector("#uploadJsonButton");
const downloadCsvButton = document.querySelector("#downloadCsvButton");
const clearDataButton = document.querySelector("#clearDataButton");
const navButtons = document.querySelectorAll(".navTab, .sidebarBtn");
const viewSections = document.querySelectorAll(".pageSection");
const hamburgerButton = document.querySelector("#hamburgerButton");
const sidebar = document.querySelector("#appSidebar");
const mobileNavOverlay = document.querySelector("#mobileNavOverlay");
let featuresInitialized = false;

function createAuthContainer() {
  const div = document.createElement("div");
  div.id = "authContainer";
  document.body.prepend(div);
  return div;
}

const errorTargets = {
  description: document.querySelector("#descriptionError"),
  amount: document.querySelector("#amountError"),
  category: document.querySelector("#categoryError"),
  date: document.querySelector("#dateError")
};

const budgetErrorTargets = {
  usdRate: document.querySelector("#usdRateError"),
  eurRate: document.querySelector("#eurRateError"),
  cap: document.querySelector("#monthlyBudgetError")
};

const budgetInputs = { usdRate: usdRateInput, eurRate: eurRateInput, cap: monthlyBudgetInput };

function setFieldError(name, message) {
  const target = errorTargets[name];
  const input = expenseForm?.elements[name];
  if (target) target.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearErrors() {
  Object.keys(errorTargets).forEach((name) => setFieldError(name, ""));
}

function setBudgetError(name, message) {
  const target = budgetErrorTargets[name];
  const input = budgetInputs[name];
  if (target) target.textContent = message;
  if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
}

function clearBudgetErrors() {
  Object.keys(budgetErrorTargets).forEach((name) => setBudgetError(name, ""));
}

function applySavedSettingsToForm() {
  if (usdRateInput) usdRateInput.value = String(state.settings.usdRate);
  if (eurRateInput) eurRateInput.value = String(state.settings.eurRate);
  if (monthlyBudgetInput) monthlyBudgetInput.value = state.settings.cap ? String(state.settings.cap) : "";
  if (defaultCurrencySelect) defaultCurrencySelect.value = state.settings.defaultCurrency;
  if (displayCurrencySelect) displayCurrencySelect.value = state.settings.displayCurrency;
  if (themeToggle) themeToggle.checked = state.settings.theme === "dark";
  if (showWeeklyChartCheck) showWeeklyChartCheck.checked = state.settings.showWeeklyChart;
  if (compactTableCheck) compactTableCheck.checked = state.settings.compactTable;
  if (confirmBeforeDeleteCheck) confirmBeforeDeleteCheck.checked = state.settings.confirmBeforeDelete;
  if (expenseCurrencySelect) expenseCurrencySelect.value = state.settings.defaultCurrency;
}

function applyDisplaySettings() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.body.dataset.theme = state.settings.theme;
  document.body.classList.toggle("compactTable", state.settings.compactTable);
  if (chartBox) chartBox.hidden = !state.settings.showWeeklyChart;
}

function setActiveView(viewName) {
  viewSections.forEach((section) => {
    const isActive = section.id === viewName;
    section.hidden = !isActive;
    section.classList.toggle("is-active", isActive);
  });

  navButtons.forEach((button) => {
    const isActive = button.dataset.view === viewName;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    if (button.role === "tab") button.setAttribute("aria-selected", String(isActive));
    if (isActive && button.classList.contains("sidebarBtn")) {
      button.setAttribute("aria-current", "page");
    } else if (button.classList.contains("sidebarBtn")) {
      button.removeAttribute("aria-current");
    }
  });

  if (sidebar) sidebar.classList.remove("open");
  if (mobileNavOverlay) mobileNavOverlay.classList.remove("open");
  if (hamburgerButton) hamburgerButton.setAttribute("aria-expanded", "false");

  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.setActiveView = setActiveView;

function readExpenseForm() {
  return {
    description: expenseForm.elements.description.value,
    amount: expenseForm.elements.amount.value,
    category: expenseForm.elements.category.value,
    date: expenseForm.elements.date.value,
    currency: expenseForm.elements.currency.value
  };
}

function fillExpenseForm(record) {
  expenseForm.elements.description.value = record.description;
  expenseForm.elements.amount.value = record.amount;
  expenseForm.elements.category.value = record.category;
  expenseForm.elements.date.value = record.date;
  expenseForm.elements.currency.value = record.currency;
  state.editingId = record.id;
  addExpenseButton.textContent = "Update Expense";
  formMessage.textContent = `Editing ${record.description}.`;
  expenseForm.scrollIntoView({ behavior: "smooth", block: "start" });
  expenseForm.elements.description.focus();
}

function resetExpenseForm(message = "Form cleared.") {
  state.editingId = null;
  if (addExpenseButton) addExpenseButton.textContent = "Add Expense";
  clearErrors();
  if (expenseCurrencySelect) expenseCurrencySelect.value = state.settings.defaultCurrency;
  if (formMessage) formMessage.textContent = message;
}

function sortExpenseList(expenses, sortValue) {
  const sorted = [...expenses];
  return sorted.sort((a, b) => {
    if (sortValue === "date-asc") return a.date.localeCompare(b.date);
    if (sortValue === "date-desc") return b.date.localeCompare(a.date);
    if (sortValue === "description-asc") return a.description.localeCompare(b.description);
    if (sortValue === "description-desc") return b.description.localeCompare(a.description);
    if (sortValue === "amount-asc") return a.amount - b.amount;
    if (sortValue === "amount-desc") return b.amount - a.amount;
    return 0;
  });
}

function formatExpenseAmount(record) {
  return `${record.currency} ${record.amount.toLocaleString(undefined, {
    minimumFractionDigits: record.amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDisplayMoney(amountRwf) {
  const currency = state.settings.displayCurrency;
  if (currency === "USD") {
    return `USD ${(amountRwf / state.settings.usdRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === "EUR") {
    return `EUR ${(amountRwf / state.settings.eurRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return formatRwf(amountRwf);
}

function parsePositiveNumber(value) {
  const trimmed = value.trim();
  const number = Number(trimmed);
  return { empty: trimmed === "", valid: trimmed !== "" && Number.isFinite(number) && number > 0, value: number };
}

function parseCap(value) {
  const trimmed = value.trim();
  const number = Number(trimmed);
  return { empty: trimmed === "", valid: trimmed === "" || (Number.isFinite(number) && number >= 0), value: trimmed === "" ? 0 : number };
}

let lastPersistedSettingsJson = "";

function readBudgetSettings() {
  if (!usdRateInput || !eurRateInput || !monthlyBudgetInput) return false;
  const usdRate = parsePositiveNumber(usdRateInput.value);
  const eurRate = parsePositiveNumber(eurRateInput.value);
  const cap = parseCap(monthlyBudgetInput.value);
  clearBudgetErrors();
  if (!usdRate.valid) setBudgetError("usdRate", "Enter a USD rate greater than 0.");
  if (!eurRate.valid) setBudgetError("eurRate", "Enter a EUR rate greater than 0.");
  if (!cap.valid) setBudgetError("cap", "Enter 0, a positive budget, or leave empty.");
  if (!usdRate.valid || !eurRate.valid || !cap.valid) return false;

  saveBudgetSettings({
    usdRate: usdRate.value, eurRate: eurRate.value, cap: cap.value,
    defaultCurrency: defaultCurrencySelect?.value,
    displayCurrency: displayCurrencySelect?.value,
    theme: themeToggle?.checked ? "dark" : "light",
    showWeeklyChart: showWeeklyChartCheck?.checked ?? true,
    compactTable: compactTableCheck?.checked ?? false,
    confirmBeforeDelete: confirmBeforeDeleteCheck?.checked ?? true,
  });
  return true;
}

function showWeeklyChartFn() {
  if (!weeklyChart || !weeklySummary) return;
  const days = getLastSevenDays(state.records, state.settings);
  weeklyChart.innerHTML = "";
  days.forEach((day) => {
    const bar = document.createElement("span");
    bar.style.setProperty("--bar-height", `${day.percent}%`);
    bar.title = `${day.date}: ${formatRwf(day.total)}`;
    weeklyChart.append(bar);
  });
  weeklySummary.textContent = days.map((day) => `${day.label}: ${formatRwf(day.total)}`).join(", ");
}

function showFinancialSummary() {
  if (!readBudgetSettings()) {
    if (budgetMessage) budgetMessage.textContent = "Fix the budget fields before the summary is updated.";
    return;
  }
  const stats = calculateStats(state.records, state.settings);
  if (totalTransactions) totalTransactions.textContent = String(stats.totalTransactions);
  if (totalExpenses) totalExpenses.textContent = formatDisplayMoney(stats.totalExpenses);
  if (mainCategory) mainCategory.textContent = stats.mainCategory;

  if (!state.settings.cap) {
    if (remainingBalance) remainingBalance.textContent = "Set budget";
    if (budgetMessage) { budgetMessage.textContent = "Enter a monthly budget to see the remaining balance."; budgetMessage.classList.remove("danger"); }
  } else {
    const balance = state.settings.cap - stats.totalExpenses;
    const isOverBudget = balance < 0;
    if (remainingBalance) remainingBalance.textContent = `${formatDisplayMoney(Math.abs(balance))} ${isOverBudget ? "over" : "left"}`;
    if (budgetMessage) {
      budgetMessage.textContent = isOverBudget
        ? `Your expenses are over the monthly budget by ${formatDisplayMoney(Math.abs(balance))}.`
        : `Your remaining balance is ${formatDisplayMoney(balance)}.`;
      budgetMessage.classList.toggle("danger", isOverBudget);
    }
  }
  showWeeklyChartFn();
}

function appendHighlightedCell(row, value, regex) {
  const cell = document.createElement("td");
  cell.append(highlightedFragment(String(value), regex));
  row.append(cell);
}

function createActionButton(label, className, onClick) {
  const button = document.createElement("button");
  button.className = `smallTableButton ${className}`;
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

async function showExpenseTable() {
  if (!expenseTableBody) return;
  const compiled = compileRegex(expenseSearch?.value?.trim() || "", ignoreCaseCheck?.checked);
  const regex = compiled.regex;

  let filtered;
  if (isAuthenticated()) {
    try {
      const sortVal = sortExpenses?.value || "date-desc";
      const searchVal = expenseSearch?.value?.trim() || "";
      const data = await api(`/records?sort=${encodeURIComponent(sortVal)}&search=${encodeURIComponent(searchVal)}`);
      filtered = data.records || [];
    } catch {
      filtered = [];
    }
  } else {
    filtered = sortExpenseList(
      state.records.filter((record) => recordMatches(record, regex)),
      sortExpenses?.value || "date-desc"
    );
  }

  if (searchError) searchError.textContent = compiled.error;
  expenseTableBody.innerHTML = "";

  if (compiled.error) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = compiled.error;
    row.append(cell);
    expenseTableBody.append(row);
    return;
  }

  if (filtered.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "emptyCell";
    cell.textContent = state.records.length === 0 ? "No expenses added yet." : "No matching expenses.";
    row.append(cell);
    expenseTableBody.append(row);
    return;
  }

  filtered.forEach((record) => {
    const row = document.createElement("tr");
    appendHighlightedCell(row, record.date, regex);
    appendHighlightedCell(row, record.description, regex);
    appendHighlightedCell(row, record.category, regex);
    appendHighlightedCell(row, formatExpenseAmount(record), regex);

    const actionsCell = document.createElement("td");
    const actionGroup = document.createElement("div");
    actionGroup.className = "tableButtons";
    actionGroup.append(
      createActionButton("Edit", "edit", () => { setActiveView("addExpense"); fillExpenseForm(record); }),
      createActionButton("Delete", "delete", async () => {
        const canDelete = !state.settings.confirmBeforeDelete || confirm(`Delete "${record.description}"?`);
        if (!canDelete) return;
        try {
          await api(`/records/${record.id}`, { method: "DELETE" });
          deleteRecordLocal(record.id);
          showExpenseTable();
          showFinancialSummary();
          if (formMessage) formMessage.textContent = "Expense deleted.";
        } catch (err) {
          if (formMessage) formMessage.textContent = `Error: ${err.message}`;
        }
      })
    );
    actionsCell.append(actionGroup);
    row.append(actionsCell);
    expenseTableBody.append(row);
  });
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  clearErrors();
  const result = validateTransaction(readExpenseForm());

  if (!result.valid) {
    Object.entries(result.fields).forEach(([name, field]) => setFieldError(name, field.message));
    if (formMessage) formMessage.textContent = "Please fix the highlighted fields before saving.";
    expenseForm.querySelector("[aria-invalid='true']")?.focus();
    return;
  }

  try {
    if (state.editingId) {
      const { record } = await api(`/records/${state.editingId}`, { method: "PUT", body: result.data });
      updateRecordLocal(state.editingId, record);
      resetExpenseForm("Expense updated.");
    } else {
      const { record } = await api("/records", { method: "POST", body: result.data });
      addRecordLocal(record);
      if (formMessage) formMessage.textContent = "Expense added.";
    }
    expenseForm.reset();
    if (addExpenseButton) addExpenseButton.textContent = "Add Expense";
    state.editingId = null;
    showExpenseTable();
    showFinancialSummary();
  } catch (err) {
    if (formMessage) formMessage.textContent = `Error: ${err.message}`;
  }
}

const debouncedBudgetPersist = debounce(async () => {
  if (!isAuthenticated()) return;
  const settingsJson = JSON.stringify(state.settings);
  if (settingsJson === lastPersistedSettingsJson) return;
  lastPersistedSettingsJson = settingsJson;
  try {
    await api("/settings", { method: "PUT", body: {
      usdRate: state.settings.usdRate, eurRate: state.settings.eurRate,
      cap: state.settings.cap, theme: state.settings.theme,
      defaultCurrency: state.settings.defaultCurrency, displayCurrency: state.settings.displayCurrency,
      showWeeklyChart: state.settings.showWeeklyChart, compactTable: state.settings.compactTable,
      confirmBeforeDelete: state.settings.confirmBeforeDelete,
    }});
  } catch { /* settings save failed silently */ }
}, 500);

async function handleBudgetInput() {
  const budgetIsValid = readBudgetSettings();
  if (!budgetIsValid) {
    if (settingsMessage) settingsMessage.textContent = "Settings were not saved because one or more values are invalid.";
    return;
  }
  showFinancialSummary();
  applyDisplaySettings();
  debouncedBudgetPersist();
  if (settingsMessage) settingsMessage.textContent = "Settings saved.";
}

function exportJson() {
  const data = buildExportData(state.records, state.settings, state.debts, state.schedule);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-budget-tracker-backup.json";
  link.click();
  URL.revokeObjectURL(url);
  if (settingsMessage) settingsMessage.textContent = "JSON export created.";
}

function exportCsv() {
  const rows = [
    ["Date", "Description", "Category", "Currency", "Amount"],
    ...state.records.map((record) => [record.date, record.description, record.category, record.currency, String(record.amount)])
  ];
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "student-budget-expenses.csv";
  link.click();
  URL.revokeObjectURL(url);
  if (settingsMessage) settingsMessage.textContent = "CSV export created.";
}

async function importJson() {
  const file = jsonFile?.files[0];
  if (!file) { if (settingsMessage) settingsMessage.textContent = "Choose a JSON file before importing."; return; }

  const reader = new FileReader();
  if (settingsMessage) settingsMessage.textContent = "Reading selected JSON file...";

  reader.addEventListener("load", async () => {
    try {
      const parsed = JSON.parse(reader.result);
      const result = validateImportData(parsed);
      if (!result.valid) { if (settingsMessage) settingsMessage.textContent = result.message; return; }

      if (isAuthenticated() && result.data.records?.length) {
        await api("/records/import", { method: "POST", body: { records: result.data.records } });
      }

      replaceRecords(result.data.records);
      if (result.data.settings) {
        saveBudgetSettings(result.data.settings);
        if (isAuthenticated()) {
          try {
            await api("/settings", { method: "PUT", body: {
              usdRate: result.data.settings.usdRate, eurRate: result.data.settings.eurRate,
              cap: result.data.settings.cap, theme: result.data.settings.theme,
              defaultCurrency: result.data.settings.defaultCurrency, displayCurrency: result.data.settings.displayCurrency,
              showWeeklyChart: result.data.settings.showWeeklyChart, compactTable: result.data.settings.compactTable,
              confirmBeforeDelete: result.data.settings.confirmBeforeDelete,
            }});
          } catch { /* best effort */ }
        }
      }
      if (result.data.debts) replaceDebts(result.data.debts);
      if (result.data.schedule) replaceSchedule(result.data.schedule);

      clearBudgetErrors();
      applySavedSettingsToForm();
      applyDisplaySettings();
      showExpenseTable();
      showFinancialSummary();
      if (settingsMessage) settingsMessage.textContent = `Imported ${state.records.length} records successfully.`;
    } catch {
      if (settingsMessage) settingsMessage.textContent = "Import failed because the file is not valid JSON.";
    }
  });
  reader.readAsText(file);
}

async function clearAllData() {
  if (!confirm("Clear all saved data and reset settings? This cannot be undone.")) return;

  if (isAuthenticated()) {
    try {
      for (const record of [...state.records]) {
        await api(`/records/${record.id}`, { method: "DELETE" });
      }
      for (const debt of [...(state.debts?.receivables || []), ...(state.debts?.payables || [])]) {
        await api(`/debts/${debt.id}`, { method: "DELETE" }).catch(() => {});
      }
      for (const item of [...state.schedule]) {
        await api(`/schedule/${item.id}`, { method: "DELETE" }).catch(() => {});
      }
    } catch { /* best effort */ }
  }

  replaceRecords([]);
  replaceDebts({ receivables: [], payables: [], history: [] });
  replaceSchedule([]);
  saveBudgetSettings(defaultSettings);
  lastPersistedSettingsJson = "";
  applySavedSettingsToForm();
  applyDisplaySettings();
  showExpenseTable();
  showFinancialSummary();
  if (settingsMessage) settingsMessage.textContent = "All data cleared.";
}

// ─── Auth State Management ─────────────────────────────
function showApp() {
  if (authContainer) authContainer.style.display = "none";
  if (appLayout) appLayout.style.display = "";
}

function showAuth() {
  if (appLayout) appLayout.style.display = "none";
  if (authContainer) { authContainer.style.display = ""; authContainer.innerHTML = ""; }
  renderAuthView(authContainer);
}

function showLoading() {
  if (appLayout) appLayout.style.display = "none";
  if (authContainer) {
    authContainer.style.display = "";
    authContainer.innerHTML = `
      <div class="authContainer">
        <div class="authCard" style="text-align:center; padding: 3rem;">
          <div class="authLogo" style="margin: 0 auto var(--space-4);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/></svg>
          </div>
          <p style="color: var(--c-text-secondary); font-size: var(--text-sm);">Restoring session...</p>
        </div>
      </div>
    `;
  }
}

async function initializeApp() {
  showLoading();

  const validSession = await bootstrapAuth();

  if (!validSession) {
    showAuth();
    return;
  }

  await loadAppData();
  showApp();
}

async function loadAppData() {
  try {
    const [recordsRes, settingsRes, debtsRes, scheduleRes, historyRes] = await Promise.all([
      api("/records"),
      api("/settings"),
      api("/debts"),
      api("/schedule"),
      api("/debts/history").catch(() => ({ history: [] })),
    ]);

    replaceRecords(recordsRes.records || []);
    if (settingsRes.settings) {
      const loaded = {
        usdRate: Number(settingsRes.settings.usd_rate),
        eurRate: Number(settingsRes.settings.eur_rate),
        cap: Number(settingsRes.settings.cap),
        theme: settingsRes.settings.theme,
        defaultCurrency: settingsRes.settings.default_currency,
        displayCurrency: settingsRes.settings.display_currency,
        showWeeklyChart: settingsRes.settings.show_weekly_chart,
        compactTable: settingsRes.settings.compact_table,
        confirmBeforeDelete: settingsRes.settings.confirm_before_delete,
      };
      saveBudgetSettings(loaded);
      lastPersistedSettingsJson = JSON.stringify(loaded);
    }
    replaceDebts({
      receivables: debtsRes.receivables || [],
      payables: debtsRes.payables || [],
      history: historyRes.history || []
    });
    replaceSchedule(scheduleRes.schedule || []);
  } catch (err) {
    console.error("Failed to load data:", err);
    if (settingsMessage) settingsMessage.textContent = "Failed to load data from server.";
  }

  applySavedSettingsToForm();
  applyDisplaySettings();

  if (!featuresInitialized) {
    featuresInitialized = true;

    let scheduleController = null;
    const scheduleInit = document.querySelector("#schedule");
    if (scheduleInit) {
      scheduleController = initScheduleFeature({
        state,
        elements: {
          scheduleForm: document.querySelector("#scheduleForm"),
          scheduleTableBody: document.querySelector("#scheduleTableBody"),
          scheduleCalendarList: document.querySelector("#scheduleCalendarList"),
          scheduleAlerts: document.querySelector("#scheduleAlerts"),
          scheduleMessage: document.querySelector("#scheduleMessage"),
          scheduleViewMode: document.querySelector("#scheduleViewMode"),
          scheduleFocusDate: document.querySelector("#scheduleFocusDate"),
          scheduleTotalDue: document.querySelector("#scheduleTotalDue"),
          scheduleOverdueCount: document.querySelector("#scheduleOverdueCount"),
          scheduleWeekCount: document.querySelector("#scheduleWeekCount"),
          scheduleFinanceTotal: document.querySelector("#scheduleFinanceTotal")
        },
        onPersist: () => { scheduleController?.renderAll(); },
        apiFn: api
      });
    }

    const debtInit = document.querySelector("#debt");
    if (debtInit) {
      initDebtFeature({
        state,
        stateDebtsKey: "debts",
        elements: {
          debtReceivableTotal: document.querySelector("#debtReceivableTotal"),
          debtPayableTotal: document.querySelector("#debtPayableTotal"),
          debtOverdueTotal: document.querySelector("#debtOverdueTotal"),
          debtUpcomingTotal: document.querySelector("#debtUpcomingTotal"),
          debtScoreValue: document.querySelector("#debtScoreValue"),
          debtScoreBar: document.querySelector("#debtScoreBar"),
          debtReliabilityText: document.querySelector("#debtReliabilityText"),
          receivableTableBody: document.querySelector("#receivableTableBody"),
          payableTableBody: document.querySelector("#payableTableBody"),
          debtHistoryBody: document.querySelector("#debtHistoryBody"),
          debtMessage: document.querySelector("#debtMessage"),
          debtReceivableForm: document.querySelector("#debtReceivableForm"),
          debtPayableForm: document.querySelector("#debtPayableForm"),
        },
        onPersist: () => { scheduleController?.renderAll(); },
        apiFn: api
      });
    }
  }

  setActiveView("home");
  showExpenseTable();
  showFinancialSummary();
}

async function persistSettings() {
  if (!isAuthenticated()) return;
  const settingsJson = JSON.stringify(state.settings);
  if (settingsJson === lastPersistedSettingsJson) return;
  lastPersistedSettingsJson = settingsJson;
  try {
    await api("/settings", { method: "PUT", body: {
      usdRate: state.settings.usdRate, eurRate: state.settings.eurRate,
      cap: state.settings.cap, theme: state.settings.theme,
      defaultCurrency: state.settings.defaultCurrency, displayCurrency: state.settings.displayCurrency,
      showWeeklyChart: state.settings.showWeeklyChart, compactTable: state.settings.compactTable,
      confirmBeforeDelete: state.settings.confirmBeforeDelete,
    }});
  } catch { /* silent */ }
}

// ─── Event Listeners ──────────────────────────────────
window.addEventListener("auth:login", async () => {
  showLoading();
  await loadAppData();
  showApp();
});
window.addEventListener("auth:logout", () => { showAuth(); });
window.addEventListener("auth:expired", () => {
  replaceRecords([]);
  replaceDebts({ receivables: [], payables: [], history: [] });
  replaceSchedule([]);
  lastPersistedSettingsJson = "";
  showAuth();
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.view));
});

if (expenseForm) {
  expenseForm.addEventListener("submit", handleExpenseSubmit);
  expenseForm.addEventListener("reset", () => resetExpenseForm());
}

expenseSearch?.addEventListener("input", debounce(showExpenseTable, 300));
ignoreCaseCheck?.addEventListener("change", showExpenseTable);
sortExpenses?.addEventListener("change", showExpenseTable);
usdRateInput?.addEventListener("input", handleBudgetInput);
eurRateInput?.addEventListener("input", handleBudgetInput);
monthlyBudgetInput?.addEventListener("input", handleBudgetInput);
defaultCurrencySelect?.addEventListener("change", handleBudgetInput);
displayCurrencySelect?.addEventListener("change", handleBudgetInput);
themeToggle?.addEventListener("change", handleBudgetInput);
showWeeklyChartCheck?.addEventListener("change", handleBudgetInput);
compactTableCheck?.addEventListener("change", handleBudgetInput);
confirmBeforeDeleteCheck?.addEventListener("change", handleBudgetInput);
downloadJsonButton?.addEventListener("click", exportJson);
uploadJsonButton?.addEventListener("click", importJson);
downloadCsvButton?.addEventListener("click", exportCsv);
clearDataButton?.addEventListener("click", clearAllData);

const navLogoutButton = document.querySelector("#navLogoutButton");
navLogoutButton?.addEventListener("click", () => authLogout());

const sidebarLogoutButton = document.querySelector("#sidebarLogoutButton");
sidebarLogoutButton?.addEventListener("click", () => authLogout());

if (hamburgerButton && sidebar && mobileNavOverlay) {
  hamburgerButton.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = sidebar.classList.toggle("open");
    mobileNavOverlay.classList.toggle("open", isOpen);
    hamburgerButton.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (e) => {
    if (!sidebar.classList.contains("open")) return;
    if (sidebar.contains(e.target) || hamburgerButton.contains(e.target)) return;
    sidebar.classList.remove("open");
    mobileNavOverlay.classList.remove("open");
    hamburgerButton.setAttribute("aria-expanded", "false");
  });
}

// Initial load
initializeApp();
