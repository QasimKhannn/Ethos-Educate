---
name: pdf
description: "Create, read, edit, and fill PDF files. Use to generate a PDF report/worksheet/certificate, extract text or tables from a PDF, merge/split/rotate pages, or fill a fillable PDF form."
---

# Working with PDF files (.pdf)

Pick the tool by task:

- **Create a new PDF** from content → **reportlab** (precise layout) or generate HTML and
  convert with **weasyprint** (easier for rich, styled documents).
- **Read / extract text** → **pypdf** (text + page ops) or **pdfplumber** (better for
  tables and positioned text).
- **Merge / split / rotate / stamp** → **pypdf**.
- **Fill a fillable form** → **pypdf** form fields.

Save outputs into the workspace `output/` folder.

## Setup

```bash
pip install pypdf reportlab pdfplumber --break-system-packages
# for HTML->PDF (optional, heavier): pip install weasyprint --break-system-packages
```

## Recipes

### Create a simple PDF (reportlab)

```python
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

c = canvas.Canvas("output/report.pdf", pagesize=letter)
width, height = letter
c.setFont("Helvetica-Bold", 18)
c.drawString(1 * inch, height - 1 * inch, "Class Progress Report")
c.setFont("Helvetica", 11)
c.drawString(1 * inch, height - 1.4 * inch, "Term 2 · Grade 7")
c.showPage()
c.save()
```

### Create a rich/styled PDF from HTML (weasyprint)

```python
from weasyprint import HTML
html = "<h1>Report</h1><p>Styled with normal <b>CSS</b>.</p>"
HTML(string=html).write_pdf("output/report.pdf")
```

This is usually the fastest route to a good-looking multi-section document — build the HTML
(reuse the same care as a web page), then render once.

### Extract text

```python
from pypdf import PdfReader
reader = PdfReader("input.pdf")
text = "\n".join((page.extract_text() or "") for page in reader.pages)
```

### Extract tables (pdfplumber)

```python
import pdfplumber
with pdfplumber.open("input.pdf") as pdf:
    for page in pdf.pages:
        for table in page.extract_tables():
            ...  # list of rows
```

### Merge / split / rotate

```python
from pypdf import PdfReader, PdfWriter

writer = PdfWriter()
for path in ["a.pdf", "b.pdf"]:
    for page in PdfReader(path).pages:
        writer.add_page(page)
with open("output/merged.pdf", "wb") as f:
    writer.write(f)
```

### Fill a fillable form

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("form.pdf")
writer = PdfWriter()
writer.append(reader)
writer.update_page_form_field_values(
    writer.pages[0],
    {"student_name": "Ava Chen", "grade": "7"},
)
with open("output/filled.pdf", "wb") as f:
    writer.write(f)
```

To discover field names first: `reader.get_fields()` returns the form fields and their
types. If the PDF has no form fields, it's not fillable — overlay text with reportlab and
merge it onto the page instead.

## Save

Always `os.makedirs("output", exist_ok=True)` and write into `output/`.

## Quality guidance

- For documents with structure/styling, prefer the HTML→PDF route; for exact coordinate
  control (labels, certificates), use reportlab.
- When extracting, expect imperfect text from scanned PDFs — note when a PDF looks scanned
  (little/no extractable text) rather than returning garbled output.
- Verify after writing: reopen with pypdf and report the page count.
- Never fabricate values when filling forms or reporting extracted content.
