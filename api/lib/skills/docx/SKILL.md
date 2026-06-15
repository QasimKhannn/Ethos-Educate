---
name: docx
description: "Create, edit, and analyze Word (.docx) documents. Use for letters, reports, worksheets, lesson plans, memos, and templates — turning content or a brief into a formatted Word document, or editing an existing one."
---

# Building Word documents (.docx)

Use **python-docx** to create and edit `.docx` files with headings, styles, tables, and
images. Save the finished document into the workspace `output/` folder.

## Setup

```bash
pip install python-docx --break-system-packages
```

## Workflow

1. Outline the document structure (title, headings, sections) before writing.
2. Build it with the recipes below, using **styles** rather than ad-hoc formatting so the
   document stays consistent and easy to restyle.
3. Save to `output/<descriptive-name>.docx`.
4. Verify: reopen and confirm the heading list / paragraph count; report it.

## Recipes

### New document with title and headings

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor

doc = Document()
doc.add_heading("Weekly Lesson Plan", level=0)     # 0 = title
doc.add_heading("Objectives", level=1)
doc.add_paragraph("Students will explain the water cycle.", style="List Bullet")
doc.add_paragraph("Students will label a diagram.", style="List Bullet")
```

### Paragraphs with inline formatting

```python
p = doc.add_paragraph("Note: ")
run = p.add_run("bring lab safety goggles.")
run.bold = True
run.font.size = Pt(11)
run.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
```

### Numbered list

```python
for step in ["Fill beaker", "Heat gently", "Record temperature"]:
    doc.add_paragraph(step, style="List Number")
```

### Table

```python
table = doc.add_table(rows=1, cols=3)
table.style = "Light Grid Accent 1"
hdr = table.rows[0].cells
hdr[0].text, hdr[1].text, hdr[2].text = "Day", "Topic", "Homework"
row = table.add_row().cells
row[0].text, row[1].text, row[2].text = "Mon", "Cells", "Read p.12"
```

### Image, page break, sections

```python
doc.add_picture("output/diagram.png", width=Inches(5))
doc.add_page_break()
```

### Document-wide default font

```python
style = doc.styles["Normal"]
style.font.name = "Calibri"
style.font.size = Pt(11)
```

### Save

```python
import os
os.makedirs("output", exist_ok=True)
doc.save("output/lesson-plan.docx")
```

## Editing an existing document

```python
doc = Document("input.docx")
for p in doc.paragraphs:
    if "OLD" in p.text:
        for run in p.runs:
            run.text = run.text.replace("OLD", "NEW")   # edit runs to keep formatting
```

Iterate `doc.paragraphs` and `doc.tables`; edit `run.text` in place rather than rebuilding
paragraphs, so styling is preserved.

## Quality guidance

- Use real heading styles (`level=`) so the document gets a proper outline / navigation.
- Built-in list styles (`List Bullet`, `List Number`) instead of manual "-" or "1." text.
- Consistent font and spacing via the `Normal` style; avoid per-run overrides except for
  intentional emphasis.
- For letters/reports, include the expected parts (date, recipient, subject, body, sign-off).
- Don't invent facts, names, or figures that weren't provided.
