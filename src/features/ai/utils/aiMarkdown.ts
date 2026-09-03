import { defaultSchema } from 'rehype-sanitize';

/**
 * Sanitization schema for AI study chat responses.
 *
 * Ensures all AI-rendered content is strictly sanitized against untrusted HTML / scripts
 * while preserving standard Markdown elements (bold, lists, tables, code blocks, blockquotes).
 */
export const aiSanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'code',
    'pre',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'span',
    'div',
    'hr',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: ['className'],
    span: ['className'],
    div: ['className'],
    th: ['align'],
    td: ['align'],
  },
};
