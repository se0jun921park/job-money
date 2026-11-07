# Career Payback Race

An interactive web app comparing lifetime earnings against education costs for eight US careers:
General Doctor, Specialized Doctor, Lawyer, Engineer, Software Engineer, Investment Banker, Dentist and Teacher.

Pick up to three careers to compare side by side:

- **Earnings race:** an animated year-by-year chart from age 18 to 65, showing either net earnings to date (pay minus tuition, loan payments and the loan balance still owed) or yearly pay. Under the chart, a standings board re-sorts as the lead changes. You can play, pause, scrub, change the speed, and hover or use the arrow keys for exact values.
- **Summary cards:** education cost, years in school, starting salary, peak salary, loan repayment with interest, the age at which earnings cover school costs, and net lifetime earnings after loan repayment.
- **Table:** all eight careers, sortable by column.
- **Assumptions:** public in-state or private tuition, the share of tuition paid with loans, the repayment term (10, 20 or 25 years), and before-tax or after-tax pay.

The selected careers are saved in the URL hash, for example `index.html#gp-swe-teacher`.

## Running it

It is a static site with no build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Files

| File | Purpose |
|------|---------|
| `data.js` | Salaries, tuition, loan rates and resident stipends, with a source for each figure |
| `model.js` | Year-by-year simulation of school, residency, pay, loan interest and repayment, and taxes |
| `app.js` | UI: career picker, animated race chart, standings, cards and table |
| `styles.css` | Styles, with light and dark themes |

## Data sources (US, 2025 dollars)

- Tuition: College Board *Trends in College Pricing 2025*, AAMC Tuition & Student Fees (2025-26), LSAC LawHub (2024), ADA Health Policy Institute dental education survey
- Pay: BLS OEWS / Occupational Outlook Handbook (May 2024), Medscape Physician Compensation Reports 2025–2026, NACE Salary Survey, NALP Class of 2024, NEA Rankings & Estimates 2024-25, and street compensation surveys for investment banking
- Residency: AAMC 2025 Survey of Resident/Fellow Stipends
- Loans: 2025-26 federal Direct Unsubsidized loan rates (6.39% undergraduate, 7.94% graduate)
- Taxes: 2025 IRS brackets for a single filer, FICA, and a flat 5% state tax

The page's Methodology section lists every source with a link. Real outcomes vary widely, so each career is modeled as a typical path, not a forecast.
