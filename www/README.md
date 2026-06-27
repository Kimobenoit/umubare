np# Student Budget Tracker

A small student-built web app for recording expenses, checking a monthly budget, and keeping a simple backup of saved data.

## What It Does

- Add, edit, delete, search, and sort expenses.
- Show total expenses, number of records, main category, and remaining balance.
- Convert USD and EUR expenses into RWF totals using manual rates.
- Save data and settings in the browser.
- Import and export JSON backups.
- Export expenses as CSV.
- Switch between light and dark mode.
- Choose display currency, default expense currency, chart visibility, compact table mode, and delete confirmation.

## Project Files

```text
index.html
assets/
  css/student-budget.css
  js/main.js
  js/expenses.js
  js/budget.js
  js/formChecks.js
  js/searchTools.js
  js/savedData.js
seed.json
package.json
```

## Run The Project

Place the folder inside XAMPP `htdocs`, start Apache, and open:

```text
http://localhost/summative/index.html
```

For a quick JavaScript syntax check:

```bash
npm run check
```

## Sample Data

The app now loads sample expenses automatically on first run when no saved data exists.
If you want to import a different backup later, you can still use `seed.json` from the Settings section.
