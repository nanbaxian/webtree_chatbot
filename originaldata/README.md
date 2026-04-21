# Original RAG Sources

This directory stores the raw source material used for KnowledgeOS RAG ingestion.
Files here are preserved in their original form and grouped by source type.

## Layout

- `site_archive/`
  - Public website archive content captured from `webtreeedu.com`
  - Best for direct text chunking and citation extraction
- `staff/`
  - Staff / faculty source documents
  - Best for OCR/text extraction and QA generation
- `academic/`
  - Schedules, calendars, and other operational spreadsheets
  - Best for table extraction and structured ingestion
- `ossd/`
  - Ontario Secondary School Diploma reference summaries
  - Best for graduation requirements, course-code explanations, and stream reference
  - Course outline summaries for common OSSD subjects
- `university/`
  - Ontario university program seed content
  - Best for admission requirements and program comparison questions
- `media/screenshots/`
  - Image evidence and message captures
  - Best for OCR, manual transcription, or provenance-only storage

## Current Files

- `site_archive/webtreeedu_site_archive_full.md`
- `staff/teachers.docx`
- `academic/Master Timetable 2025-2026 (1).xlsx`
- `ossd/ossd_core_guide.md`
- `ossd/ossd_course_outlines.md`
- `university/ontario_university_programs_seed.md`
- `media/screenshots/Screenshot_20260419_200523_WeChat.jpg`
- `media/screenshots/Screenshot_20260419_200532_WeChat.jpg`

## Ingestion Notes

- Keep these files immutable unless you are intentionally refreshing the raw corpus.
- Prefer generating processed artifacts elsewhere, such as `rag-service/ingest/` or a dedicated staging folder.
- For RAG ingestion, the most useful order is usually:
  1. `site_archive/`
  2. `academic/`
  3. `ossd/`
  4. `staff/`
  5. `media/screenshots/`

## Processed Layer

Processed, RAG-friendly artifacts are stored under `processed/`.

- `processed/site_archive/webtreeedu_site_archive_full.normalized.md`
- `processed/academic/master_timetable.extracted.md`
- `processed/staff/teachers.extracted.md`
- `processed/ossd/ossd_core_guide.md`
- `processed/ossd/ossd_course_outlines.md`
- `processed/university/ontario_university_programs_seed.md`
- `processed/media/screenshots.manifest.md`
- `processed/qa_seed.json`
- `processed/qa_seed_delta.json`
- `processed/qa_seed_delta2.json`
- `processed/qa_seed_delta3.json`
- `processed/qa_seed_delta4.json`
- `processed/qa_seed_delta5.json`
- `processed/qa_seed_delta6.json`

These files are intended for chunking, QA generation, and later ingestion into the external RAG PostgreSQL store.
Screenshot assets are currently excluded from the ingestion set.
