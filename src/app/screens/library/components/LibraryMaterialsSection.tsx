import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';
import type { MaterialMembershipFilter } from '../../../../features/materials/types/libraryFilter.types';
import LibraryView from '../../../../features/materials/components/LibraryView';
import { PreviewStepper } from './PreviewStepper';
import { OVERVIEW_STEPS } from '../utils/overviewSteps';

export interface LibraryMaterialsSectionProps {
  /** False outside overview + materials views — renders nothing. */
  visible: boolean;
  isOverview: boolean;
  isLoading: boolean;
  /** Materials matching the active search + tags + membership filters. */
  materials: StudyMaterial[];
  limit?: number;
  totalMaterialCount: number;
  allTags: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearFilters: () => void;
  membershipFilter: MaterialMembershipFilter;
  onMembershipFilterChange: (filter: MaterialMembershipFilter) => void;
  onOpen: (material: StudyMaterial) => void;
  onEdit: (material: StudyMaterial) => void;
  onRemove: (material: StudyMaterial) => void;
  onStartQuiz: (material: StudyMaterial) => void;
  onManage: (materialId: string) => void;
  onOpenCollection: (collectionId: string) => void;
  onBrowseAvailable: () => void;
  level: number;
  onLevelChange: (level: number) => void;
  onViewAll: () => void;
}

/**
 * Materials half of the library: the filterable section plus the overview
 * stepper. Extracted so `LibraryScreen` stays a composer.
 */
export function LibraryMaterialsSection({
  visible,
  isOverview,
  isLoading,
  materials,
  limit,
  totalMaterialCount,
  allTags,
  searchQuery,
  onSearchChange,
  selectedTags,
  onToggleTag,
  onClearFilters,
  membershipFilter,
  onMembershipFilterChange,
  onOpen,
  onEdit,
  onRemove,
  onStartQuiz,
  onManage,
  onOpenCollection,
  onBrowseAvailable,
  level,
  onLevelChange,
  onViewAll,
}: LibraryMaterialsSectionProps) {
  if (!visible) return null;
  return (
    <>
      <LibraryView
        isLoading={isLoading}
        materials={materials}
        limit={limit}
        totalMaterialCount={totalMaterialCount}
        allTags={allTags}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        selectedTags={selectedTags}
        onToggleTag={onToggleTag}
        onClearFilters={onClearFilters}
        membershipFilter={membershipFilter}
        onMembershipFilterChange={onMembershipFilterChange}
        onOpen={onOpen}
        onEdit={onEdit}
        onRemove={onRemove}
        onStartQuiz={onStartQuiz}
        onManage={(m) => onManage(m.id)}
        onNavigate={onOpenCollection}
        onBrowseAvailable={onBrowseAvailable}
      />
      {isOverview && materials.length > OVERVIEW_STEPS[0] && (
        <PreviewStepper
          shown={Math.min(limit ?? materials.length, materials.length)}
          total={materials.length}
          level={level}
          onLevelChange={onLevelChange}
          onViewAll={onViewAll}
          noun="materials"
        />
      )}
    </>
  );
}

export default LibraryMaterialsSection;
