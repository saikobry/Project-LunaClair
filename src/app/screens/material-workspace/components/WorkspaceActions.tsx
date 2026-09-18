import * as stylex from '@stylexjs/stylex';
import { FileText, Package, Share2 } from 'lucide-react';
import { Button } from '../../../../shared/ui/Button/Button';
import { AiDrawerToggleButton } from '../../../../features/ai/components/AiDrawerToggleButton';
import { useMediaQuery } from '../../../../shared/hooks/useMediaQuery';
import { useExportStudyPackage } from '../../../../features/package/hooks/useExportStudyPackage';
import { workspaceStyles } from '../styles/materialWorkspace.stylex';

export interface WorkspaceActionsProps {
  materialId: string;
  isAiOpen: boolean;
  onToggleAi: () => void;
  onShare: () => void;
  /** Whether a preserved import original exists — the Source action renders only then. */
  hasSource: boolean;
  onOpenSource: () => void;
}

/**
 * Material-level workspace actions: Source (preserved original, conditional),
 * Share, Export as .lcpack, and the AI assistant toggle. The single home for
 * material Share/Export — the embedded tabs carry no material-level
 * Share/Export of their own. Collapses to icon-only buttons under 640px so
 * the actions fit beside the title instead of wrapping into a second row.
 */
export function WorkspaceActions({ materialId, isAiOpen, onToggleAi, onShare, hasSource, onOpenSource }: WorkspaceActionsProps) {
  const { exportPackage, isExporting } = useExportStudyPackage();
  const isCompact = useMediaQuery('(max-width: 640px)');

  return (
    <div {...stylex.props(workspaceStyles.actions)}>
      {hasSource && (
        <Button
          label="Source"
          variant="secondary"
          icon={<FileText size={15} />}
          isIconOnly={isCompact}
          onClick={onOpenSource}
        >
          Source
        </Button>
      )}
      <Button
        label="Share"
        variant="secondary"
        icon={<Share2 size={15} />}
        isIconOnly={isCompact}
        onClick={onShare}
      >
        Share
      </Button>
      <Button
        label="Export as .lcpack"
        variant="secondary"
        icon={<Package size={15} />}
        isIconOnly={isCompact}
        onClick={() => exportPackage(materialId)}
        isLoading={isExporting}
        isDisabled={isExporting}
      >
        Export as .lcpack
      </Button>
      <AiDrawerToggleButton
        isOpen={isAiOpen}
        onToggle={onToggleAi}
      />
    </div>
  );
}
