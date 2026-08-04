/**
 * LunaClair adapter for @astryxdesign/core Outline's markdown parser.
 *
 * Kept in its own file (separate from the Outline component) so feature
 * modules can import it through `shared/ui` without importing
 * `@astryxdesign/core` directly.
 */
export { parseOutlineFromMarkdown } from '@astryxdesign/core/Outline';
