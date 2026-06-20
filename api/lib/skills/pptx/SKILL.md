---
name: pptx
description: "Create, edit, and analyze PowerPoint (.pptx) presentations. Use when the goal is a slide deck, lecture slides, pitch deck, or any .pptx deliverable — turning an outline, document, or dataset into finished slides."
---

# Building PowerPoint presentations (.pptx)

Build `.pptx` files programmatically with the **python-pptx** library. It writes valid
OpenXML, so you never edit XML by hand. Always save the finished deck into the workspace
`output/` folder.

## Setup

```bash
pip install python-pptx --break-system-packages
```

## Workflow

1. **Plan the deck first.** Decide the slide list (title, agenda, one idea per content
   slide, summary). Keep one main point per slide; move detail into speaker notes.
2. **Build slide by slide** using the recipes below.
3. **Save** to `output/<descriptive-name>.pptx`.
4. **Sanity-check**: reopen the file with python-pptx and confirm the slide count and that
   each slide has the expected title — report this back.

## Core concepts

- A `Presentation` has `slides`; each slide is created from a **layout** in
  `prs.slide_layouts` (0 = Title, 1 = Title+Content, 5 = Title Only, 6 = Blank).
- Position/size use English Metric Units — always wrap numbers in `Inches(...)` or `Pt(...)`.
- Default slide size is 10×7.5 in (4:3). For 16:9 set `prs.slide_width/height`.

## Recipes

### New deck + title slide, 16:9

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

slide = prs.slides.add_slide(prs.slide_layouts[0])
slide.shapes.title.text = "Photosynthesis"
slide.placeholders[1].text = "Grade 7 Biology · Unit 3"
```

### Bullet content slide

```python
slide = prs.slides.add_slide(prs.slide_layouts[1])
slide.shapes.title.text = "Key stages"
body = slide.placeholders[1].text_frame
body.text = "Light-dependent reactions"          # first bullet
for line in ["Calvin cycle", "Gas exchange"]:
    p = body.add_paragraph()
    p.text = line
    p.level = 0                                    # 1+ for sub-bullets
```

### Text box with explicit styling (blank layout)

```python
slide = prs.slides.add_slide(prs.slide_layouts[6])
box = slide.shapes.add_textbox(Inches(1), Inches(1), Inches(11), Inches(1.2))
tf = box.text_frame
tf.word_wrap = True
run = tf.paragraphs[0].add_run()
run.text = "Big idea of the lesson"
run.font.size = Pt(36)
run.font.bold = True
run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)
```

### Image

```python
slide = prs.slides.add_slide(prs.slide_layouts[6])
slide.shapes.add_picture("output/diagram.png", Inches(1), Inches(1), width=Inches(8))
```

### Table

```python
rows, cols = 3, 2
tbl = slide.shapes.add_table(rows, cols, Inches(1), Inches(1.5),
                             Inches(8), Inches(3)).table
tbl.cell(0, 0).text = "Term"
tbl.cell(0, 1).text = "Definition"
```

### Native chart

```python
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE

data = CategoryChartData()
data.categories = ["Q1", "Q2", "Q3"]
data.add_series("Scores", (78, 85, 91))
slide.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED,
                       Inches(1), Inches(1.5), Inches(8), Inches(4.5), data)
```

### Speaker notes

```python
slide.notes_slide.notes_text_frame.text = "Spend ~3 min; ask the recall question first."
```

### Save

```python
import os
os.makedirs("output", exist_ok=True)
prs.save("output/photosynthesis.pptx")
```

## Editing an existing deck

Open it, iterate `prs.slides` and `slide.shapes`, and for text use
`shape.has_text_frame` then walk `text_frame.paragraphs[*].runs`. Replace `run.text` to
preserve formatting rather than rewriting whole text frames.

## Quality guidance

- One idea per slide; aim for ≤6 lines and ≤8 words per line. Push detail to notes.
- Use a consistent palette (2–3 colors) and font sizes (title ~32–40pt, body ~18–24pt).
- Prefer the layout placeholders over absolute-positioned boxes when you can — they stay
  aligned across slides.
- Charts/tables beat walls of numbers. Label axes and series.
- Don't fabricate data, quotes, or citations. If a figure isn't given, leave a clear
  placeholder rather than inventing it.
