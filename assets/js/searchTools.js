export function compileRegex(input, caseInsensitive = true) {
  try {
    return input
      ? { regex: new RegExp(input, caseInsensitive ? "gi" : "g"), error: "" }
      : { regex: null, error: "" };
  } catch {
    return { regex: null, error: "Invalid regex pattern. Please check the search expression." };
  }
}

export function recordMatches(record, regex) {
  if (!regex) {
    return true;
  }

  const searchable = `${record.date} ${record.description} ${record.category} ${record.currency} ${record.amount}`;
  regex.lastIndex = 0;
  return regex.test(searchable);
}

export function highlightedFragment(text, regex) {
  const fragment = document.createDocumentFragment();

  if (!regex) {
    fragment.append(document.createTextNode(text));
    return fragment;
  }

  const value = String(text);
  const safeRegex = new RegExp(regex.source, regex.flags);
  let lastIndex = 0;
  let match = safeRegex.exec(value);

  while (match) {
    if (match.index > lastIndex) {
      fragment.append(document.createTextNode(value.slice(lastIndex, match.index)));
    }

    const mark = document.createElement("mark");
    mark.textContent = match[0];
    fragment.append(mark);

    lastIndex = match.index + match[0].length;

    if (match[0].length === 0) {
      safeRegex.lastIndex += 1;
    }

    match = safeRegex.exec(value);
  }

  if (lastIndex < value.length) {
    fragment.append(document.createTextNode(value.slice(lastIndex)));
  }

  return fragment;
}
