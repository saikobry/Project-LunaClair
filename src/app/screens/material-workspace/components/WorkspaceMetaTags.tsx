import * as stylex from '@stylexjs/stylex';
import { Chip } from '../../../../shared/ui/Chip/Chip';
import { workspaceStyles } from '../styles/materialWorkspace.stylex';

export interface WorkspaceMetaTagsProps {
  tags?: string[];
}

/**
 * Material tag row under the workspace header (shared `Chip` vocabulary).
 * Renders nothing for untagged materials.
 */
export function WorkspaceMetaTags({ tags }: WorkspaceMetaTagsProps) {
  if (!tags || tags.length === 0) return null;
  return (
    <div {...stylex.props(workspaceStyles.tagRow)}>
      {tags.map((tag) => (
        <Chip key={tag} variant="neutral" style={workspaceStyles.tagChip}>
          #{tag}
        </Chip>
      ))}
    </div>
  );
}
