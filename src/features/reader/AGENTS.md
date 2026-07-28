# src/features/reader/ — Reader Feature

## Purpose

Core reading experience with advanced annotation capabilities: markdown rendering, text highlighting (CSS Custom Highlight API), freehand drawing (SVG canvas), floating TOC, and selection popover with highlight/delete actions.

## Ownership

| File / Module | Responsibility |
|---|---|
| `ReaderScreen.tsx` | Feature orchestrator — accepts `materialId`; resolves document via `useDocument` hook, renders loading/error/success states, wires annotation hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell) |
| `ReaderView.tsx` | Presentation — renders MarkdownViewer + DrawingCanvas + AnnotationToolbar + SelectionPopover |
| `components/MarkdownViewer.tsx` | Renders processed markdown via `react-markdown` + `rehype-highlight` |
| `components/DrawingCanvas.tsx` | Freehand SVG drawing canvas with pen/eraser tools |
| `components/SelectionPopover.tsx` | Floating popover on text selection — highlight color picker or delete existing highlight |
| `components/AnnotationToolbar.tsx` | Tool mode switcher (select/draw) + actions (undo drawing, clear all, open TOC) |
| `components/Toc.tsx` | Floating table of contents panel extracted from markdown headings |
| `queries/readerQueryKeys.ts` | Query key factory: `root`, `document(id)`, `highlights(docId)`, `drawings(docId)` |
| `hooks/useDocumentRepository.ts` | DI consumer hook returning `DocumentRepository` from context |
| `hooks/useAnnotationRepository.ts` | DI consumer hook returning `AnnotationRepository` from context |
| `hooks/useDocument.ts` | TanStack Query hook resolving `Document` from `StudyMaterial` via `DocumentRepository` |
| `hooks/useHighlights.ts` | TanStack Query–backed highlight state + CSS Custom Highlight API registration |
| `hooks/useDrawings.ts` | TanStack Query–backed drawing paths + body scroll-lock when drawing |
| `hooks/useTextSelection.ts` | Listens to `selectionchange`, computes popover position, detects highlight clicks |
| `hooks/mutations/useSaveHighlights.ts` | Mutation: persist full highlights array (optimistic) |
| `hooks/mutations/useDeleteHighlight.ts` | Mutation: remove single highlight by ID (optimistic) |
| `hooks/mutations/useClearHighlights.ts` | Mutation: clear all highlights (optimistic) |
| `hooks/mutations/useSaveDrawings.ts` | Mutation: persist full drawing paths array (optimistic) |
| `hooks/mutations/useClearDrawings.ts` | Mutation: clear all drawings (optimistic) |
| `types/reader.types.ts` | Reader-specific types (`PopoverState`) |
| `styles/reader.css` | Reader-specific CSS with `::highlight()` pseudo-elements for multi-color highlights |

## Local Contracts

- Markdown content is fetched from `public/materials/{sourceId}/index.md` and preprocessed by `services/content/markdownPreprocessor` (not in this feature)
- `ReaderScreen` handles `DocumentNotFoundError` with a friendly UI notice and unexpected errors separately
- Highlights persist via `AnnotationRepository` under `STORAGE_KEYS.reader.highlights` (`lunaclair.reader.highlights`)
- Drawings persist via `AnnotationRepository` under `STORAGE_KEYS.reader.drawings` (`lunaclair.reader.drawings`)
- All annotation methods require an explicit `documentId` parameter
- Drawing mode locks body scroll (`overflow: hidden`, `touchAction: none`, `overscrollBehavior: none`)
- Highlights use the CSS Custom Highlight API (`CSS.highlights.set`) — no DOM wrapper nodes
- Text selection offsets are computed via shared utility `getOffsetsOfRange` / `restoreRange` from `shared/utils/selection.ts`
- Annotation types (`HighlightItem`, `DrawingPath`, `Point`, etc.) live in `shared/types/annotation.types.ts`
- Query hooks and mutation hooks are separated; mutations live in `hooks/mutations/`
- DI hooks (`useDocumentRepository`, `useAnnotationRepository`) provide repository access via context

## Work Guidance

- Tool modes: `select` (highlight/delete) | `draw` (freehand pen/eraser)
- Drawing tools: `pen` | `eraser`
- Highlight colors: `yellow`, `green`, `pink`, `blue`
- Brush colors: Red, Blue, Green, Orange, Purple, Black
- Thickness options: 2, 4, 8, 12

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
