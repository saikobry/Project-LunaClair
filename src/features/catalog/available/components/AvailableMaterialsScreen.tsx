import * as stylex from '@stylexjs/stylex';
import { BookOpen, Download, Trash2, WifiOff } from 'lucide-react';
import type { StudyMaterial } from '../../../../domain/library';
import { Page } from '../../../../shared/ui/Page';
import { Button } from '../../../../shared/ui/Button/Button';
import { Card } from '../../../../shared/ui/Card';
import { Chip } from '../../../../shared/ui/Chip/Chip';
import { CardGridSkeleton } from '../../../../shared/ui/Skeleton/Skeleton';
import { useAvailableCatalog } from '../hooks/queries/useAvailableCatalog';
import { useImportMaterial } from '../hooks/mutations/useImportMaterial';
import { useRemoveImportedMaterial } from '../hooks/mutations/useRemoveImportedMaterial';
import { useLibrary } from '../../materials/hooks/queries/useLibrary';
import { styles } from '../../shared/styles/library.stylex';

const localStyles = stylex.create({
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  sectionCount: {
    fontSize: 13,
    color: 'var(--color-text-disabled)',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--color-text-primary)',
    margin: 0,
    lineHeight: 1.3,
  },
  cardDescription: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
  },
});

interface AvailableMaterialsScreenProps {
  onOpenMaterial: (materialId: string) => void;
}

/**
 * "Available Materials" — the remote D1 catalog surfaced as server state.
 *
 * Nothing here is auto-imported into Dexie. Each material shows its import
 * status (available remotely / in the local library) and an explicit
 * [ Add to Library ] / [ Remove from Library ] action. Imported materials open
 * via the normal workspace route.
 */
export function AvailableMaterialsScreen({ onOpenMaterial }: AvailableMaterialsScreenProps) {
  const { catalog, isLoading, isError } = useAvailableCatalog();
  const { materials: localMaterials } = useLibrary();
  const importMutation = useImportMaterial();
  const removeMutation = useRemoveImportedMaterial();

  const localIds = new Set(localMaterials.map((m) => m.id));
  const materialsBySubject = new Map<string, StudyMaterial[]>();
  const ungrouped: StudyMaterial[] = [];

  for (const material of catalog?.materials ?? []) {
    if (material.subjectId) {
      const list = materialsBySubject.get(material.subjectId) ?? [];
      list.push(material);
      materialsBySubject.set(material.subjectId, list);
    } else {
      ungrouped.push(material);
    }
  }

  const subjects = catalog?.subjects ?? [];

  const description = isLoading
    ? undefined
    : catalog
      ? `${catalog.materials.length} ${catalog.materials.length === 1 ? 'material' : 'materials'} available from the platform`
      : undefined;

  const renderMaterialCard = (material: StudyMaterial) => {
    const imported = localIds.has(material.id);
    const busy = importMutation.isPending || removeMutation.isPending;

    return (
      <Card key={material.id}>
        <div {...stylex.props(localStyles.card)}>
          <h3 {...stylex.props(localStyles.cardTitle)}>{material.title}</h3>
          {material.description && (
            <p {...stylex.props(localStyles.cardDescription)}>{material.description}</p>
          )}
          <div {...stylex.props(localStyles.cardFooter)}>
            <Chip variant={imported ? 'accent' : 'neutral'}>
              {imported ? 'In My Library' : 'Available'}
            </Chip>
            <div style={{ display: 'flex', gap: 8 }}>
              {imported ? (
                <>
                  <Button
                    label={`Open ${material.title}`}
                    variant="secondary"
                    icon={<BookOpen size={14} />}
                    onClick={() => onOpenMaterial(material.id)}
                  >
                    Open
                  </Button>
                  <Button
                    label={`Remove ${material.title} from your library`}
                    variant="secondary"
                    icon={<Trash2 size={14} />}
                    isDisabled={busy}
                    onClick={() => removeMutation.mutate(material.id)}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <Button
                  label={`Add ${material.title} to your library`}
                  variant="primary"
                  icon={<Download size={14} />}
                  isDisabled={busy}
                  onClick={() => importMutation.mutate(material.id)}
                >
                  Add to Library
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Page title="Available Materials" description={description}>
      {/* Loading State */}
      {isLoading && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Loading…</h2>
          </div>
          <CardGridSkeleton count={6} />
        </div>
      )}

      {/* Error / Offline state — catalog never fetched */}
      {!isLoading && (isError || !catalog) && (
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <WifiOff size={64} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>Catalog unavailable</h2>
          <p {...stylex.props(styles.emptyText)}>
            The platform catalog could not be loaded — this is your first visit
            while offline, or the API is unreachable. Connect to the internet and
            try again.
          </p>
        </div>
      )}

      {/* Subject groups */}
      {!isLoading && catalog && subjects.map((subject) => {
        const group = materialsBySubject.get(subject.id) ?? [];
        if (group.length === 0) return null;
        return (
          <div key={subject.id} {...stylex.props(localStyles.section)}>
            <div {...stylex.props(localStyles.sectionHeader)}>
              <h2 {...stylex.props(localStyles.sectionTitle)}>{subject.title}</h2>
              <span {...stylex.props(localStyles.sectionCount)}>
                {group.length} {group.length === 1 ? 'material' : 'materials'}
              </span>
            </div>
            <div {...stylex.props(styles.grid)}>
              {group.map(renderMaterialCard)}
            </div>
          </div>
        );
      })}

      {/* Ungrouped materials */}
      {!isLoading && catalog && ungrouped.length > 0 && (
        <div {...stylex.props(localStyles.section)}>
          <div {...stylex.props(localStyles.sectionHeader)}>
            <h2 {...stylex.props(localStyles.sectionTitle)}>Other</h2>
            <span {...stylex.props(localStyles.sectionCount)}>
              {ungrouped.length} {ungrouped.length === 1 ? 'material' : 'materials'}
            </span>
          </div>
          <div {...stylex.props(styles.grid)}>
            {ungrouped.map(renderMaterialCard)}
          </div>
        </div>
      )}

      {/* Empty catalog */}
      {!isLoading && catalog && catalog.materials.length === 0 && (
        <div {...stylex.props(styles.emptyState)}>
          <div {...stylex.props(styles.emptyIcon)}>
            <BookOpen size={64} />
          </div>
          <h2 {...stylex.props(styles.emptyTitle)}>No materials available</h2>
          <p {...stylex.props(styles.emptyText)}>
            The platform catalog is empty. Check back later.
          </p>
        </div>
      )}
    </Page>
  );
}

export default AvailableMaterialsScreen;
