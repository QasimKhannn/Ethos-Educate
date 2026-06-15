---
name: xlsx
description: "Create, edit, and analyze Excel (.xlsx) spreadsheets. Use for gradebooks, budgets, data tables, trackers, and reports — building a workbook from data, adding formulas/formatting/charts, or reading and transforming an existing sheet."
---

# Building Excel spreadsheets (.xlsx)

Use **openpyxl** for reading/writing `.xlsx` with formatting, formulas, and charts. For
heavy data transformation, use **pandas** to compute, then write out with openpyxl for
styling. Save the finished workbook into the workspace `output/` folder.

## Setup

```bash
pip install openpyxl pandas --break-system-packages
```

## Important: formula values

openpyxl **writes** formulas but does not **evaluate** them — the cached value stays empty
until a real spreadsheet app opens the file. Two consequences:

- If you only need the file for a user to open in Excel, writing formulas is fine.
- If *you* need the computed result in the same run (e.g. to chart or validate it),
  compute it in Python (pandas or plain Python) and write the value, not the formula.
  Don't write a formula and then read it back expecting a number.

## Recipes

### New workbook with a header row and data

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
ws = wb.active
ws.title = "Grades"

headers = ["Student", "Quiz 1", "Quiz 2", "Average"]
ws.append(headers)
for c in ws[1]:
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="1F4E79")
    c.alignment = Alignment(horizontal="center")

rows = [["Ava", 88, 92], ["Liam", 75, 81]]
for r in rows:
    avg = round(sum(r[1:]) / len(r[1:]), 1)   # compute in Python (see note above)
    ws.append(r + [avg])
```

### Formulas (for the user to recalc in Excel)

```python
ws["D2"] = "=AVERAGE(B2:C2)"
```

### Column widths, number formats, freeze panes

```python
ws.column_dimensions["A"].width = 18
for row in ws.iter_rows(min_row=2, min_col=2, max_col=4):
    for cell in row:
        cell.number_format = "0.0"
ws.freeze_panes = "A2"            # keep header visible
```

### Chart

```python
from openpyxl.chart import BarChart, Reference

chart = BarChart()
chart.title = "Averages"
data = Reference(ws, min_col=4, min_row=1, max_row=ws.max_row)
cats = Reference(ws, min_col=1, min_row=2, max_row=ws.max_row)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats)
ws.add_chart(chart, "F2")
```

### Multiple sheets

```python
summary = wb.create_sheet("Summary")
summary["A1"] = "Class average"
summary["B1"] = round(sum(r[3] for r in ws.iter_rows(min_row=2, values_only=True)) / (ws.max_row - 1), 1)
```

### Save

```python
import os
os.makedirs("output", exist_ok=True)
wb.save("output/grades.xlsx")
```

## Reading / transforming an existing sheet

```python
import pandas as pd
df = pd.read_excel("input.xlsx", sheet_name=0)
# ...transform...
df.to_excel("output/cleaned.xlsx", index=False)
```

Use `data_only=True` in `openpyxl.load_workbook` to read **cached** values instead of
formula strings (only present if the file was last saved by a spreadsheet app).

## Quality guidance

- Always give a header row, sensible column widths, and number formats — raw unstyled
  dumps look unfinished.
- Freeze the header row; bold/shade it.
- Keep one table per sheet; use a separate Summary sheet for totals.
- Verify after writing: reopen with `load_workbook` and check sheet names, dimensions, and
  a couple of cell values; report them.
- Never invent data values that weren't provided.
