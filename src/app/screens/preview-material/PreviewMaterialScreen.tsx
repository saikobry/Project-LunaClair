import * as stylex from '@stylexjs/stylex';
import { BookOpen, Download, Eye, FileQuestion } from 'lucide-react';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { Chip } from '../../../shared/ui/Chip/Chip';
import { Breadcrumbs, type BreadcrumbItem } from '../../../shared/ui/Breadcrumbs/Breadcrumbs';
import { WorkspaceSkeleton } from '../../../shared/ui/Skeleton/Skeleton';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';
import MarkdownViewer from '../../../features/reader/components/MarkdownViewer';
import { useAvailableMaterial } from '../../../features/discovery/hooks/queries/useAvailableMaterial';
import { usePreviewDocument } from '../../../features/discovery/hooks/queries/usePreviewDocument';
import { useImportMaterial } from '../../../features/discovery/hooks/mutations/useImportMaterial';
import { useLibrary } from '../../../features/materials/hooks/queries/useLibrary';

const styles = stylex.create({
  metadataRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  stickyBar: {
    position: 'sticky',
    top: 12,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    marginBottom: 24,
    borderRadius: 12,
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background-surface)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
  },
  stickyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  stickyIcon: {
    color: 'var(--color-accent)',
    flexShrink: 0,
  },
  stickyTextGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  stickyTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  stickySubtext: {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary)',
    fontSize: 14,
  },
});

export interface PreviewMaterialScreenProps {
  materialId: string;
  onBack: () => void;
  onOpenMaterial: (materialId: string, subjectId?: string) => void;
}

/**
 * "Read-only preview" — a distinct surface for inspecting a material from the
 * Available Materials catalog before committing to Add to Library.
 *
 * Deliberately NOT the material workspace:
 * - resolves the material from the remote catalog (authoritative per-id),
 *   never from the local library
 * - renders the document read-only (no annotations, no progress, no
 *   "last opened" touch, no local study state)
 * - features a sticky top banner with preview context and Add to Library CTA
 */
export function PreviewMaterialScreen({ materialId, onBack, onOpenMaterial }: PreviewMaterialScreenProps) {
  const { data: resolution, isLoading: materialLoading, isError } = useAvailableMaterial(materialId);
  const material = resolution?.material ?? null;
  const subject = resolution?.subject;
  const term = resolution?.term;
  const { data: document, isLoading: docLoading, error } = usePreviewDocument(material);
  const importMutation = useImportMaterial();
  const { materials: localMaterials } = useLibrary();

  const imported = material ? localMaterials.some((m) => m.id === material.id) : false;
  const isLoading = materialLoading || docLoading;

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Available Materials', onClick: onBack },
    ...(material ? [{ label: material.title }] : []),
  ];

  const handleAddToLibrary = () => {
    if (!material) return;
    importMutation.mutate(material.id, {
      onSuccess: () => onOpenMaterial(material.id, subject?.id),
    });
  };

  if (isLoading) {
    return (
      <Page title="Preview" breadcrumb={<Breadcrumbs items={breadcrumbItems} />}>
        <div {...stylex.props(styles.loading)}>
          <WorkspaceSkeleton />
        </div>
      </Page>
    );
  }

  if (isError || !material) {
    return (
      <Page title="Preview" breadcrumb={<Breadcrumbs items={breadcrumbItems} />}>
        <ErrorState
          icon={<FileQuestion size={48} />}
          title="Material could not be found."
          description="This material may have been removed from the catalog."
          action={
            <Button label="Back to Available Materials" variant="secondary" onClick={onBack}>
              Back to Available Materials
            </Button>
          }
        />
      </Page>
    );
  }

  const primaryAction = imported ? (
    <Button
      label={`Open ${material.title}`}
      variant="secondary"
      icon={<BookOpen size={14} />}
      onClick={() => onOpenMaterial(material.id, subject?.id)}
    >
      Open
    </Button>
  ) : (
    <Button
      label={`Add ${material.title} to your library`}
      variant="primary"
      icon={<Download size={14} />}
      isDisabled={importMutation.isPending}
      onClick={handleAddToLibrary}
    >
      Add to Library
    </Button>
  );

  return (
    <Page
      title={material.title}
      description={material.description}
      breadcrumb={<Breadcrumbs items={breadcrumbItems} />}
    >
      {/* Subject & Term Metadata */}
      {(term || subject) && (
        <div {...stylex.props(styles.metadataRow)}>
          {term && <Chip variant="accent">{term.title}</Chip>}
          {subject && <Chip variant="neutral">{subject.title}</Chip>}
        </div>
      )}

      {/* Sticky Preview Header */}
      <div {...stylex.props(styles.stickyBar)}>
        <div {...stylex.props(styles.stickyInfo)}>
          <Eye size={16} {...stylex.props(styles.stickyIcon)} />
          <div {...stylex.props(styles.stickyTextGroup)}>
            <p {...stylex.props(styles.stickyTitle)}>Read-only Preview</p>
            <p {...stylex.props(styles.stickySubtext)}>
              {imported
                ? 'Available in your library — open for full workspace with quizzes and notes'
                : 'Add to library to enable interactive quizzes, notes, and offline access'}
            </p>
          </div>
        </div>
        {primaryAction}
      </div>

      {/* Document content */}
      {error ? (
        <ErrorState
          title="Document could not be loaded."
          description="The document content could not be fetched right now. Try again when you're back online."
        />
      ) : (
        <MarkdownViewer text={document?.content ?? ''} />
      )}
    </Page>
  );
}

export default PreviewMaterialScreen;
