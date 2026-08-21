# Ethos Educate MCP Output Review And Fix Plan

## Honest Verdict

- Current outputs are structurally valid, but most are not yet production-ready for teachers.
- The certificate work can stay template-based because certificates are visual awards.
- The rubric is the closest to usable, but still needs stronger grade-aware descriptor logic and cleaner scoring support.
- The worksheet generator is not acceptable yet for serious classroom use. It creates files, but the AP sample is too thin, too text-like, and the answer key is not a real worked-solutions key.
- The decks are clean but generic. They look like reusable card layouts, not fully prepared lessons.
- Word/PDF outputs are polished markdown converters, not yet true school artifact generators.
- Excel and charts are readable, but too light for actual teacher workflow unless we add dashboards, validation, formulas, conditional formatting, and decision guidance.

## Review Limitations

- PDFs and PPTX files were rendered locally into `Ethos_Quality_Review/visual_contact_sheet_full.png`.
- DOCX visual rendering is blocked on this machine because LibreOffice/Word CLI is not installed. DOCX content and structure were inspected directly.
- Google Drive search did not find the AP worksheet by title. To review the exact imported Google Docs version, provide the Google Docs/Drive link.

## Free Tooling Stack

- DOCX: `python-docx` plus OOXML helpers for margins, tables, styles, headers, and page breaks.
- PDF: `reportlab` for direct PDF, or HTML/CSS to PDF using a free renderer where available.
- Slides: `python-pptx` for generation, LibreOffice headless for render QA.
- Excel: `openpyxl` for workbooks, formulas, data validation, conditional formatting, print setup, and charts.
- Charts: `matplotlib`, `seaborn`, and `Pillow` for annotated chart/dashboard images.
- Math: `sympy` for answer validation where applicable, plus math text rendering for clean equations instead of raw `e^(2x)` style text.
- QA rendering: LibreOffice headless, Poppler, `pdf2image`, and Pillow contact sheets.
- Tests: `pytest`/current test scripts plus golden-file structural checks and rendered-image checks.

## Tool Review

### `create_teacher_worksheet`

- Current state: Generates separate student worksheet and teacher answer key in PDF/DOCX.
- What is good: Student/key separation exists, sections exist, output is readable, simple layout works.
- What is not good: Too few questions, raw math formatting, no diagrams/graphs, two-column high-school layout feels cramped, answer key is a table instead of worked solutions, no difficulty progression, no grading rubric for FRQ items.
- Fix:
  - Add worksheet archetypes by type: practice, exit ticket, quiz review, AP/test prep, guided notes, vocabulary, lab/data analysis.
  - Add minimum content contracts by grade/type: question count, section mix, writing space, page count, and answer-key depth.
  - Use a real math formatting path for equations.
  - Make student layout problem-first, not table-first.
  - Make teacher key solution-first: final answer, steps, common errors, grading notes.
  - Add optional graphs, tables, coordinate grids, diagrams, and source/data blocks.
  - Validate answer keys with deterministic checks where possible, especially math.

### `rubric_creator`

- Current state: Editable DOCX analytic rubric with descriptors.
- What is good: This is closest to school-ready. It has criteria, four levels, scoring, comments, and editable format.
- What is not good: Descriptors can still be generic, table can become dense, no single-point/checklist variants, no grade-friendly language mode.
- Fix:
  - Add rubric types: analytic, single-point, checklist, standards-based, project, writing, presentation, lab.
  - Add grade-band language controls.
  - Add scoring math, teacher comment prompts, and optional student self-assessment column.
  - Add descriptor quality checks to reject vague wording.

### `presentation_deck_creator`

- Current state: 11-slide classroom flow from scratch.
- What is good: Clean, unbranded, consistent, renders correctly after local HOME is set.
- What is not good: Fixed card pattern, generic lesson flow, limited visuals, no speaker notes, no checks for pacing/content depth, not enough subject-specific teaching material.
- Fix:
  - Replace fixed 11-slide skeleton with a deck planner that chooses layout based on lesson type and grade band.
  - Add slide archetypes: direct instruction, worked example, misconception check, data prompt, discussion protocol, guided practice, independent task, exit ticket.
  - Add speaker notes with teacher moves and timing.
  - Add visual support when relevant: diagrams, charts, image placeholders, process maps, lab setup visuals.
  - Add render QA for every slide and fail on overlap/clipping.

### `create_powerpoint_presentation`

- Current state: Generic slide builder with title/content/chart/two-column/KPI/quote/image slide types.
- What is good: More flexible than the classroom deck and can include charts.
- What is not good: Still depends heavily on caller-supplied content, can produce thin decks, no narrative planner, no teacher activity structure.
- Fix:
  - Add school deck mode with narrative planning before slide creation.
  - Add minimum slide content rules and speaker notes.
  - Add chart/data validation and source/caption fields.
  - Remove empty section-slide behavior unless it has a real purpose.

### `create_word_from_markdown`

- Current state: Good-looking markdown-to-DOCX converter.
- What is good: Useful for generic briefs, study guides, handouts, and parent/admin notes.
- What is not good: It does not understand school artifact types. It can make a thin memo look polished.
- Fix:
  - Add document archetypes: lesson plan, study guide, parent letter, intervention brief, unit plan, meeting agenda, observation notes, sub plan.
  - Add required sections per archetype.
  - Add callouts, checklists, action tables, and print-friendly page breaks.
  - Add DOCX render QA through free LibreOffice.

### `create_pdf_from_markdown`

- Current state: Styled PDF converter.
- What is good: Clean typography and readable tables.
- What is not good: The sample report is not school-useful. It is basically a formatting demo.
- Fix:
  - Share the same archetype planner as DOCX.
  - Add PDF-specific layout components: executive summary, action plan, evidence table, appendix, signatures, page numbers.
  - Add full PDF render checks and reject outputs under a content-depth threshold.

### `create_excel_from_markdown`

- Current state: Creates a readable workbook with tables, frozen headers, formulas, and print setup.
- What is good: Functional base for trackers.
- What is not good: One-sheet output is too basic for real teacher workflows. No dashboard sheet, no validation lists, no conditional formatting rules rich enough for daily use.
- Fix:
  - Add workbook archetypes: intervention tracker, standards mastery tracker, gradebook, attendance tracker, behavior log, assessment item analysis.
  - Generate multi-sheet workbooks: `Dashboard`, `Students`, `Entries`, `Lookup`, `Notes`.
  - Add formulas, status calculations, conditional formatting, data validation dropdowns, print areas, and protected formula cells.
  - Add Google Sheets compatibility testing.

### `create_data_chart` And `create_multi_chart_dashboard`

- Current state: Clean static PNG charts.
- What is good: Readable labels, target line, summary stat badge.
- What is not good: Still basic. It does not tell a teacher/admin what action to take.
- Fix:
  - Add chart intent detection: growth, mastery, attendance, intervention, comparison, trend.
  - Add annotations, benchmark labels, outlier callouts, sample size, timeframe, and next-step caption.
  - For dashboards, add summary cards and a "teacher action" panel.
  - Add visual QA for small text and crowded labels.

### Utility Tools

- `create_csv_from_data`, `analyze_csv_data`, `merge_csv_files`, `convert_json_to_yaml`, `convert_yaml_to_json`, `convert_csv_to_json`, `convert_json_to_csv`, `convert_markdown_to_html`.
- Current state: Utility converters, not teacher-facing finished artifacts.
- Fix:
  - Keep them simple.
  - Add validation, clean errors, and better filenames.
  - Do not market these as classroom-ready documents.

## Root Causes

- We are checking file validity, not actual classroom readiness.
- The content planner is too weak. Short prompts produce short content.
- The layout engine uses generic structures: tables, cards, and markdown conversion.
- There is no grade/type-specific artifact contract.
- There is no rendered visual QA gate in CI/local tests.
- There is no accuracy validation layer for answer keys.

## Implementation Plan

1. Add a shared artifact quality contract.
   - Inputs: grade, subject, artifact type, time length, output format.
   - Outputs: minimum sections, minimum item count, required teacher supports, layout density, answer-key depth.

2. Rebuild worksheet generation first.
   - Split student worksheet layout from teacher key layout.
   - Add worksheet planners for AP/test prep, elementary practice, exit ticket, guided notes, lab/data analysis, vocabulary, and review packet.
   - Add math rendering and answer validation where possible.
   - Add full worked solutions and scoring guidance.

3. Add a local render QA harness.
   - Set `HOME` and `USERPROFILE` correctly.
   - Use Poppler for PDFs and LibreOffice for DOCX/PPTX/XLSX once installed.
   - Generate contact sheets automatically.
   - Fail tests on blank pages, tiny outputs, clipped text signals, missing sections, no answer key, or old branding.

4. Upgrade presentation generators.
   - Create a slide planner and layout library, not one fixed deck.
   - Add speaker notes, teaching moves, visuals, checks for understanding, and grade-aware density.

5. Upgrade DOCX/PDF converters into school artifact builders.
   - Keep markdown conversion as a utility path.
   - Add explicit school modes for lesson plans, study guides, briefs, sub plans, parent letters, and reports.

6. Upgrade Excel and charts.
   - Generate multi-sheet workbooks with formulas and dashboards.
   - Add decision-ready chart annotations and teacher action callouts.

7. Add real acceptance tests.
   - Teacher prompt tests using one-line prompts.
   - Complex academic prompt tests.
   - Output structure tests.
   - Rendered visual tests.
   - Accuracy tests for deterministic subjects like math.
   - Google Drive import/export smoke tests when file links/access are available.

## Priority

1. Worksheet generator.
2. Render QA harness.
3. Presentation deck generator.
4. Excel trackers and dashboards.
5. DOCX/PDF school artifact modes.
6. Rubric refinements.
7. Utility tool cleanup.
