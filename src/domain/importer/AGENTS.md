# src/domain/importer/ — Content Importer Domain

## Purpose

Pure domain contracts, types, and algorithms for importing external study materials (PDFs, images) and transforming raw extracted text into structured Markdown.

## Ownership

- `ContentImporter.ts` — `ContentImporter` port, `ImporterRegistry` port, `ExtractionOptions` interface.
- `importer.types.ts` — Domain types (`ExtractionResult`, `PageExtraction`, `ExtractionStats`, `ExtractionProgress`, `ImportMetadata`, `ImportCandidate`, `ImportSession`, `ImportError`, `ImportErrorCode`).
- `ImportAssetRepository.ts` — write-only `ImportAssetRepository` port (`put`) and `ImportedAsset` contract for preserving original imported binary files (PDF/images). Stays deliberately single-asset-per-material (an import owns exactly one original file), so on this write path `materialId` IS the asset identity; `DexieImportAssetRepository` writes `assetId = materialId` into the shared `localAssets` store. Reads are the generic `AssetRepository` port's job (`domain/assets`), and removal is `DexieLibraryImportService.removeMaterial`'s job (it must commit inside the material-delete transaction), so this port never becomes a second read or delete path over the same store.
- `services/DocumentChunker.ts` — Pure domain service (`chunkDocument`, `extractDocumentOutline`, `splitTextRun`) for semantically slicing large markdown documents into bounded chunks (~8,000 chars) along heading seams and paragraph breaks, strictly guarding fenced code blocks, tables, and blockquotes without crossing syntax boundaries. Implements hierarchical boundary search in `splitTextRun` within an elastic target window (target -20% / +25%: min 0.80 * target, max 1.25 * target; paragraph double newline -> list item marker -> sentence punctuation -> newline/whitespace fallback -> hard cut at target) ensuring cuts never land mid-sentence or mid-list-item when higher-priority breaks exist.
- `markdownConverter/` — Multi-pass Markdown conversion pipeline:
  - `normalizationPass.ts`: Line ending normalization, Unicode space cleaning, page break artifact removal.
  - `structurePass.ts`: Heading detection (ALL CAPS, numbered sections, chapters).
  - `pageAnchorPass.ts`: Page anchor injection (`## Page N` + `---`).
  - `listPass.ts`: Bullet and numbered list formatting.
  - `tablePass.ts`: Key-value and tabular column detection to GFM tables.
  - `cleanupPass.ts`: Whitespace trimming, horizontal rule formatting, final newline guarantee.
  - `index.ts`: Orchestrates all passes into `convertToMarkdown(pages, options)`.

## Local Contracts

- Importers return raw `ExtractionResult` only — Markdown conversion is performed exclusively by the application layer (`ExtractContentUseCase`) via `convertToMarkdown`.
- Multi-page extractions include `## Page N` anchors separated by `---` horizontal rules.
- Per-page metadata (`source: 'pdf-text' | 'ocr' | 'ai-vision'`, `confidence: number`) is preserved across extraction and review models.
- Partial extractions set `isPartial: true` on `ExtractionResult` to signify incomplete processing upon cancellation.
- Document chunking in `splitTextRun` strictly prioritizes paragraph boundaries (double newlines), list-item starts, and sentence boundaries over mid-sentence line breaks within an elastic window (min 0.80 * target, max 1.25 * target), preventing sentence fragmentation across OCR page transitions.
- Domain logic contains 0 React, 0 Dexie, and 0 browser DOM dependencies.

## Work Guidance

- Every pipeline pass is a pure function: `(text: string) => string` (or `(pages: PageExtraction[]) => string`).
- New file formats (e.g. DOCX, EPUB) implement `ContentImporter` and register with `ImporterRegistry`.

## Verification

- `npm run test:run` — Unit tests for each markdown converter pass and pipeline integration.
- `npm run build`
- `npm run lint`

## Child DOX Index

- None.
