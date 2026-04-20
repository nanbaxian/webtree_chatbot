# Processed RAG Artifacts

This folder contains normalized, RAG-friendly derivatives of the raw source files in `originaldata/`.

## Contents

- `site_archive/webtreeedu_site_archive_full.normalized.md`
  - Normalized copy of the website archive source
  - Best for broad semantic chunking and page-level citations
- `academic/master_timetable.extracted.md`
  - Text extraction of the timetable workbook
  - Best for schedule lookup, date/term questions, and operational QA
- `staff/teachers.extracted.md`
  - Text extraction of the staff directory document
  - Best for faculty bios, responsibilities, and teaching style lookup
- `media/screenshots.manifest.md`
  - Provenance-only inventory of screenshot assets
  - Excluded from the current RAG ingestion set
- `qa_seed.json`
  - Curated question/answer seed pairs distilled from the processed corpus
  - Best for direct lookup, canonical answers, and high-confidence retrieval

## Recommended Ingestion Order

1. `site_archive/`
2. `academic/`
3. `staff/`
4. `media/screenshots/`

## Notes

- These files are derived artifacts and can be regenerated from the raw sources.
- Keep the raw files in `originaldata/` unchanged unless the corpus itself is being refreshed.
- If OCR is later added, the screenshot assets should produce a separate extracted text layer rather than replacing the images.
