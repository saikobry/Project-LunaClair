# src/features/writer/ — LunaClair Writer

## Purpose

LunaClair Writer is the WYSIWYG authoring and study material editing engine built on Lexical. It delivers standard Lexical capabilities and lossless Markdown transformation for real-world LunaClair study materials (headings H1–H6, paragraphs, inline formatting, multi-level nested lists, GFM tables, images, blockquotes, and horizontal rules).

## Ownership

- `components/MaterialWriterTab.tsx` — Workspace-embedded material writer tab: loads current markdown, manages dirty state, provides explicit save, discard, copy, export actions, and mounts `WriterEditor`.
- `components/WriterEditor.tsx` — Lexical editor core wrapper with `RichTextPlugin`, `HistoryPlugin`, `ListPlugin`, `TablePlugin`, `LinkPlugin`, `MarkdownShortcutPlugin`, and `OnChangePlugin`.
- `components/WriterToolbar.tsx` — Modular formatting toolbar composing subcomponents for history, block types, inline styles, indentation, and insert actions.
- `components/toolbar/` — Granular toolbar subcomponents and StyleX styles (`WriterToolbarHistory`, `WriterToolbarBlockFormat`, `WriterToolbarInlineFormat`, `WriterToolbarIndents`, `WriterToolbarInserts`, `toolbarStyles.ts`).
- `hooks/mutations/useUpdateDocumentContent.ts` — TanStack Query mutation hook delegating document updates to `context.useCases.content.updateDocumentContent` and invalidating reader caches.
- `nodes/standardNodes.ts` — Standard Lexical node registry (`HeadingNode`, `QuoteNode`, `ListNode`, `ListItemNode`, `TableNode`, `TableRowNode`, `TableCellNode`, `LinkNode`, `AutoLinkNode`, `CodeNode`, `CodeHighlightNode`, `HorizontalRuleNode`, `ImageNode`).
- `nodes/ImageNode.tsx` — DecoratorNode for standard markdown images (`![alt](src)`).
- `transformers/standardTransformers.ts` — Standard Markdown transformer bundle (`HR`, `TABLE`, `IMAGE`, `ENHANCED_UNORDERED_LIST`, `ENHANCED_ORDERED_LIST`, and `@lexical/markdown` transformers).
- `theme/writerTheme.ts` — Lexical theme class mappings adhering to LunaClair typography and surface tokens.
- `theme/writer.css` — Scoped CSS stylesheets for Lexical editor surfaces, tables, code blocks, and blockquotes.

## Local Contracts

- **Direct-path contracts only (ADR-010):** No feature-root barrel (`index.ts`). Outside consumers import directly from `src/features/writer/components/MaterialWriterTab`.
- **Architectural Boundary Guardrails:** Zero concrete persistence or infrastructure dependencies. Pure document transformations and standard Lexical nodes.
- **Lossless Markdown Guarantee:** Standard markdown structures (H1–H6, 2-space & 4-space nested lists, GFM tables, standard images, bold/italic/code) survive import → edit → export cycles without AST or structural degradation.
- **Accessible UI:** All toolbar controls and editor surfaces adhere to ARIA standards and keyboard shortcuts.

## Work Guidance

- Standard Lexical nodes: no custom figure/callout/definition AST nodes until standard baseline is extended.
- All styles must use StyleX or scoped CSS classes mapped in `writerTheme.ts`.

## Verification

- `npm run build` — TypeScript and Vite production bundle check.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files — this leaf feature owns its internal structure directly.
