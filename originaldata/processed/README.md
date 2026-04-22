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
- `ossd/ossd_core_guide.md`
  - Compact OSSD reference summary
  - Best for graduation requirements, course-code interpretation, and stream explanations
- `ossd/ossd_course_outlines.md`
  - Common OSSD course outline summaries
  - Best for course-family questions and program planning
- `university/ontario_university_programs_seed.md`
  - Ontario university program admission seed set
  - Best for popular program prerequisites, averages, and supplementary applications
- `competitions/canada_us_competitions_exams.md`
  - Canada and US competitions plus major test guide
  - Best for admissions tests, math contests, CS contests, and English proficiency questions
- `media/screenshots.manifest.md`
  - Provenance-only inventory of screenshot assets
  - Excluded from the current RAG ingestion set
- `qa_seed.json`
  - Curated question/answer seed pairs distilled from the processed corpus
  - Best for direct lookup, canonical answers, and high-confidence retrieval
- `qa_seed_delta.json`
  - Additional site-archive and OSSD core QA items added later
  - Best for top-up ingestion without replaying the original QA seed
- `qa_seed_delta2.json`
  - Faculty and leadership QA top-up
  - Best for founder/principal/teacher lookups
- `qa_seed_delta3.json`
  - Teacher-profile QA top-up
  - Best for staff subject, specialty, and teaching-style lookups
- `qa_seed_delta4.json`
  - Schedule and after-school QA top-up
  - Best for timetable and club-time questions
- `qa_seed_delta5.json`
  - Alias QA for schedule phrasing variants
  - Best for natural-language variants of timetable questions
- `qa_seed_delta6.json`
  - Additional academic schedule and club QA
  - Best for period timing, summer, planning, and club questions
- `university/ontario_university_programs_seed.md`
  - Ontario university program admission seed set
  - Best for popular program prerequisites, averages, and supplementary applications

## Recommended Ingestion Order

1. `site_archive/`
2. `academic/`
3. `staff/`
4. `ossd/`
5. `university/`
6. `competitions/`
7. `media/screenshots/`

## Notes

- These files are derived artifacts and can be regenerated from the raw sources.
- Keep the raw files in `originaldata/` unchanged unless the corpus itself is being refreshed.
- If OCR is later added, the screenshot assets should produce a separate extracted text layer rather than replacing the images.
