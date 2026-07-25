# src/features/reader/ — Reader Feature

## Purpose

Core reading experience with advanced annotation capabilities: markdown rendering, text highlighting (CSS Custom Highlight API), freehand drawing (SVG canvas), floating TOC, and selection popover with highlight/delete actions.

## Ownership

| File / Module | Responsibility |
|---|---|
| `ReaderScreen.tsx` | Feature orchestrator — wires hooks, manages tool mode (`select` \| `draw`), coordinates highlights + drawings |
| `ReaderView.tsx` | Presentation — renders MarkdownViewer + DrawingCanvas + AnnotationToolbar + SelectionPopover |
| `components/MarkdownViewer.tsx` | Renders processed markdown via `react-markdown` + `rehype-highlight` |
| `components/DrawingCanvas.tsx` | Freehand SVG drawing canvas with pen/eraser tools |
| `components/SelectionPopover.tsx` | Floating popover on text selection — highlight color picker or delete existing highlight |
| `components/AnnotationToolbar.tsx` | Tool mode switcher (select/draw) + actions (undo drawing, clear all, open TOC) |
| `components/Toc.tsx` | Floating table of contents panel extracted from markdown headings |
| `hooks/useHighlights.ts` | Manages highlight state + localStorage persistence + CSS Custom Highlight API registration |
| `hooks/useDrawings.ts` | Manages drawing paths + localStorage persistence + body scroll-lock when drawing |
| `hooks/useTextSelection.ts` | Listens to `selectionchange`, computes popover position, detects highlight clicks |
| `utils/markdownPreprocessor.ts` | Replaces `{{FIGUREXXX}}` placeholders with markdown image syntax |
| `types/reader.types.ts` | Reader-specific types (`PopoverState`) |
| `services/` | Reserved for reader-specific service abstractions |
| `styles/reader.css` | Reader-specific CSS with `::highlight()` pseudo-elements for multi-color highlights |
| `assets/content.md` | Sample markdown content with embedded `{{FIGURE}}` placeholders |
| `assets/images.ts` | Maps figure keys to imported image assets |

## Local Contracts

- Markdown is preprocessed before rendering: `{{FIGUREXXX}}` → `![alt](url)` (see `markdownPreprocessor.ts`)
- Highlights persist via localStorage under `STORAGE_KEYS.HIGHLIGHTS` (`reviewer-highlights`)
- Drawings persist via localStorage under `STORAGE_KEYS.PATHS` (`reviewer-paths`)
- Drawing mode locks body scroll (`overflow: hidden`, `touchAction: none`, `overscrollBehavior: none`)
- Highlights use the CSS Custom Highlight API (`CSS.highlights.set`) — no DOM wrapper nodes
- Text selection offsets are computed via shared utility `getOffsetsOfRange` / `restoreRange` from `shared/utils/selection.ts`
- Annotation types (`HighlightItem`, `DrawingPath`, `Point`, etc.) live in `shared/types/annotation.types.ts`

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
