/**
 * LunaClair Outline — thin adapter over @astryxdesign/core Outline.
 *
 * Re-exports the Astryx table-of-contents component so feature modules
 * consume it through `shared/ui` without importing `@astryxdesign/core`
 * directly.
 */
export { Outline } from '@astryxdesign/core/Outline';
export type { OutlineProps, OutlineItem } from '@astryxdesign/core/Outline';
