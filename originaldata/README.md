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
- `media/screenshots/`
  - Image evidence and message captures
  - Best for OCR, manual transcription, or provenance-only storage

## Current Files

- `site_archive/webtreeedu_site_archive_full.md`
- `staff/teachers.docx`
- `academic/Master Timetable 2025-2026 (1).xlsx`
- `media/screenshots/Screenshot_20260419_200523_WeChat.jpg`
- `media/screenshots/Screenshot_20260419_200532_WeChat.jpg`

## Ingestion Notes

- Keep these files immutable unless you are intentionally refreshing the raw corpus.
- Prefer generating processed artifacts elsewhere, such as `rag-service/ingest/` or a dedicated staging folder.
- For RAG ingestion, the most useful order is usually:
  1. `site_archive/`
  2. `academic/`
  3. `staff/`
  4. `media/screenshots/`

## Processed Layer

Processed, RAG-friendly artifacts are stored under `processed/`.

- `processed/site_archive/webtreeedu_site_archive_full.normalized.md`
- `processed/academic/master_timetable.extracted.md`
- `processed/staff/teachers.extracted.md`
- `processed/media/screenshots.manifest.md`
- `processed/qa_seed.json`

These files are intended for chunking, QA generation, and later ingestion into the external RAG PostgreSQL store.
Screenshot assets are currently excluded from the ingestion set.
