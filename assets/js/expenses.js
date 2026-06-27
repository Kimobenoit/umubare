export const defaultSettings = {
  usdRate: 1300,
  eurRate: 1450,
  cap: 0,
  theme: "light",
  defaultCurrency: "RWF",
  displayCurrency: "RWF",
  showWeeklyChart: true,
  compactTable: false,
  confirmBeforeDelete: true
};

export const state = {
  records: [],
  editingId: null,
  settings: { ...defaultSettings },
  debts: {
    receivables: [],
    payables: [],
    history: []
  },
  schedule: []
};

export function addRecordLocal(record) {
  state.records = [record, ...state.records];
}

export function updateRecordLocal(id, data) {
  state.records = state.records.map((record) =>
    record.id === id ? { ...record, ...data } : record
  );
}

export function deleteRecordLocal(id) {
  state.records = state.records.filter((record) => record.id !== id);
}

export function replaceRecords(records) {
  state.records = records;
  state.editingId = null;
}

export function replaceDebts(debts) {
  state.debts = {
    receivables: Array.isArray(debts?.receivables) ? debts.receivables : [],
    payables: Array.isArray(debts?.payables) ? debts.payables : [],
    history: Array.isArray(debts?.history) ? debts.history : []
  };
}

export function replaceSchedule(schedule) {
  state.schedule = Array.isArray(schedule) ? schedule : [];
}

export function updateSettings(settings) {
  state.settings = {
    ...state.settings,
    ...settings
  };
}
