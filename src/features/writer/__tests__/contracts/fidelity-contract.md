# LunaClair Writer — Markdown Fidelity Contract

## 1. Scope & Guarantee

LunaClair Writer guarantees **Semantic & Structural Preservation** across Markdown ⇄ Lexical transformations.

The contract guarantees that all structured knowledge (headings, nested lists, GFM tables, code blocks, blockquotes, media links, and inline text formatting) retains 100% of its semantic meaning, hierarchy, and content during import, editing, and export cycles.

Deterministic formatting normalization is permitted where Markdown allows cosmetic variation, provided the semantic AST is preserved.

---

## 2. Syntax Classification Matrix

| Category | Description | Policy / Transformation Guarantee |
|---|---|---|
| **Category A: Supported (Lossless Semantic AST)** | Standard Markdown constructs with direct 1:1 Lexical AST mappings. | Exact semantic preservation. Hierarchy, node relationships, text content, formatting flags, URLs, and alt attributes are never lost. |
| **Category B: Supported + Normalized** | Constructs where Markdown syntax permits cosmetic variety (e.g. `*` vs `-` bullets, table cell spacing). | Semantic meaning is preserved identically; exported syntax follows canonical LunaClair formatting standards. |
| **Category C: Unsupported but Harmless** | Constructs outside LunaClair's core schema (e.g. definitions, footnotes, complex raw HTML blocks). | Deterministic fallback to plain text paragraphs or standard blocks without data loss or editor crash. |
| **Category D: Unsupported & Dangerous** | Malicious or executable markup (e.g. `<script>`, `javascript:` URIs). | Strictly sanitized and rejected by rendering and parsing layers. |

---

## 3. Supported Construct Specification

### Headings
- Syntax: `# H1` through `###### H6`
- Lexical AST: `HeadingNode` (`tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'`)
- Normalization: Trailing hashes (e.g., `# Heading #`) normalized to clean headings.

### Inline Formatting
- Bold: `**bold**` or `__bold__` → `TextNode` (`format: 'bold'`)
- Italic: `*italic*` or `_italic_` → `TextNode` (`format: 'italic'`)
- Underline: `<u>underline</u>` → `TextNode` (`format: 'underline'`)
- Strikethrough: `~~strike~~` → `TextNode` (`format: 'strikethrough'`)
- Inline Code: `` `code` `` → `TextNode` (`format: 'code'`)
- Highlight: `==highlight==` → `TextNode` (`format: 'highlight'`)
- Combinations: `***bold italic***`, `<u>**bold underline**</u>`, `*<u>italic underline</u>*`

### Lists & Hierarchies
- Unordered Lists: `- item`, `* item`, `+ item` → `ListNode` (`listType: 'bullet'`) + `ListItemNode`
- Ordered Lists: `1. item`, `2. item` → `ListNode` (`listType: 'number'`, `start: N`) + `ListItemNode`
- Checklists: `- [ ] todo`, `- [x] done` → `ListNode` (`listType: 'check'`) + `ListItemNode`
- Multi-Level Nesting: 2-space, 4-space, or tab indentations mapped to Lexical list depth/indent hierarchy without losing parent-child relationships.

### Tables (GFM)
- Syntax: `| Header 1 | Header 2 |` followed by `| --- | --- |` divider and row cells.
- Lexical AST: `TableNode` → `TableRowNode` → `TableCellNode`.
- Inline Support: Table cells support full inline formatting (bold, italic, code, links, underline).
- Normalization: Column alignment pipes are normalized to standard padded syntax `| Cell 1 | Cell 2 |`.

### Images & Links
- Links: `[label](url)` → `LinkNode` (`url: string`)
- Images: `![alt](src)` → `ImageNode` (`src: string`, `altText: string`)

### Code Blocks & Blockquotes
- Fenced Code Blocks: ` ```lang ... ``` ` → `CodeNode` (`language: string`)
- Blockquotes: `> quote` → `QuoteNode`
- Horizontal Rules: `---`, `***`, `___` → `HorizontalRuleNode`

---

## 4. Conservative Normalization Rules

To verify semantic fidelity without masking structural defects, the test normalizer enforces strict limits:

### Allowed Cosmetic Normalizations:
1. **Trailing Newlines**: Single trailing newline at end-of-file.
2. **Table Pipe Spacing**: Padding between pipe delimiters `| text |` vs `|text|`.
3. **List Bullet Marker Canonicalization**: Normalizing `* ` or `+ ` to `- `.
4. **Heading Canonicalization**: Removing trailing `#` hashes and normalizing spacing after `#`.

### Strictly Forbidden from Normalization (Defects):
- ❌ Collapsing non-cosmetic newlines or blank lines separating distinct blocks.
- ❌ Normalizing list indentation (e.g. flattening nested items into top-level items).
- ❌ Altering whitespace within code blocks or inline code spans.
- ❌ Stripping or losing inline formatting inside table cells or list items.
- ❌ Swapping parent-child block relationships.
