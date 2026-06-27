export const patterns = {
  description: /^\S(?:.*\S)?$/,
  amount: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
  date: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  category: /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/,
  duplicateWords: /\b(\w+)\s+\1\b/i
};

export function validateDescription(value) {
  const original = value;
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!original) {
    return { valid: false, value: normalized, message: "Description is required." };
  }

  if (normalized.length > 100) {
    return { valid: false, value: normalized, message: "Description must be 100 characters or fewer." };
  }

  if (!patterns.description.test(original)) {
    return {
      valid: false,
      value: normalized,
      message: "Description cannot start or end with a space."
    };
  }

  if (patterns.duplicateWords.test(normalized)) {
    return {
      valid: false,
      value: normalized,
      message: "Description has a repeated word. Please remove the duplicate."
    };
  }

  return { valid: true, value: normalized, message: "" };
}

export function validateAmount(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, value: trimmed, message: "Amount is required." };
  }

  if (!patterns.amount.test(trimmed)) {
    return {
      valid: false,
      value: trimmed,
      message: "Amount must be a whole number or use up to two decimal places."
    };
  }

  return { valid: true, value: Number(trimmed), message: "" };
}

export function validateDate(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, value: trimmed, message: "Date is required." };
  }

  if (!patterns.date.test(trimmed)) {
    return { valid: false, value: trimmed, message: "Date must use YYYY-MM-DD format." };
  }
  const date = new Date(`${trimmed}T00:00:00`);
  const isRealDate =
    date.getFullYear() === Number(trimmed.slice(0, 4)) &&
    date.getMonth() + 1 === Number(trimmed.slice(5, 7)) &&
    date.getDate() === Number(trimmed.slice(8, 10));

  if (!isRealDate) {
    return { valid: false, value: trimmed, message: "Date must be a real calendar date." };
  }

  return { valid: true, value: trimmed, message: "" };
}

export function validateCategory(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { valid: false, value: trimmed, message: "Category is required." };
  }

  if (!patterns.category.test(trimmed)) {
    return {
      valid: false,
      value: trimmed,
      message: "Category can only use letters, spaces, and hyphens."
    };
  }

  return { valid: true, value: trimmed, message: "" };
}

export function validateTransaction(formData) {
  const fields = {
    description: validateDescription(formData.description),
    amount: validateAmount(formData.amount),
    category: validateCategory(formData.category),
    date: validateDate(formData.date)
  };

  const valid = Object.values(fields).every((field) => field.valid);

  return {
    valid,
    fields,
    data: valid
      ? {
          description: fields.description.value,
          amount: fields.amount.value,
          category: fields.category.value,
          date: fields.date.value,
          currency: formData.currency
        }
      : null
  };
}
