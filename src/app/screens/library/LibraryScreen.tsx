import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';
import type { MaterialMembershipFilter } from '../../../features/materials/types/libraryFilter.types';
import type { LibraryViewMode } from '../../routing/routing';
import { useLibrary } from '../../../features/materials/hooks/queries/useLibrary';
import { useAssignedMaterialIds } from '../../../features/collections/hooks/queries/useAssignedMaterialIds';
import { useCollections } from '../../../features/collections/hooks/queries/useCollections';
import { useCollectionMaterialCounts } from '../../../features/collections/hooks/queries/useCollectionMaterialCounts';
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import LibraryModals from './modals/LibraryModals';
import { OVERVIEW_STEPS } from './utils/overviewSteps';
import { LibraryViewSwitcher } from './components/LibraryViewSwitcher';
import { LibraryCollectionsSection } from './components/LibraryCollectionsSection';
import { LibraryMaterialsSection } from './components/LibraryMaterialsSection';
import { useLibraryModals } from './hooks/useLibraryModals';
import {
  useBaseMaterials,
  useFacetedTags,
  useFilteredMaterials,
  useVisibleCollections,
  formatLibraryDescription,
  shouldShowViewSwitcher,
} from './hooks/useLibraryData';

export interface LibraryScreenProps {
  /** Active membership lens from the URL. `undefined` reads as `all`. */
  filter?: MaterialMembershipFilter;
  onFilterChange: (filter: MaterialMembershipFilter) => void;
  /** Active library view from the URL. `undefined` reads as `overview`. */
  view?: LibraryViewMode;
  onViewChange: (view: LibraryViewMode) => void;
  onOpenMaterial: (materialId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManage: (materialId: string) => void;
  onOpenCollection: (collectionId: string) => void;
  onBrowseAvailable: () => void;
}

export function LibraryScreen({
  filter,
  onFilterChange,
  view,
  onViewChange,
  onOpenMaterial,
  onStartQuiz,
  onManage,
  onOpenCollection,
  onBrowseAvailable,
}: LibraryScreenProps) {
  const { materials: libraryMaterials, isLoading: materialsLoading } = useLibrary();
  const { assignedIds } = useAssignedMaterialIds();
  const { collections, isLoading: collectionsLoading } = useCollections();
  const { counts } = useCollectionMaterialCounts();

  const {
    editTarget,
    deleteTarget,
    showCreateMaterial,
    showCreateCollection,
    handleNewMaterial,
    handleEditTrigger,
    handleEditSave,
    handleEditClose,
    handleCreateMaterialSave,
    handleCreateMaterialClose,
    handleDeleteTrigger,
    handleDeleteConfirm,
    handleDeleteClose,
    openCreateCollection,
    handleCreateCollectionSave,
    handleCreateCollectionClose,
  } = useLibraryModals();

  const membershipFilter: MaterialMembershipFilter = filter ?? 'all';
  const activeView: LibraryViewMode = view ?? 'overview';

  // Overview preview expansion, per list (index into OVERVIEW_STEPS).
  const [collectionsLevel, setCollectionsLevel] = useState(0);
  const [materialsLevel, setMaterialsLevel] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [collectionSearch, setCollectionSearch] = useState('');

  // Faceted tag row: search + membership scope the pills (selected tags
  // excluded from the derivation so picking one never hides co-occurring tags).
  const baseMaterials = useBaseMaterials(libraryMaterials, {
    searchQuery,
    membershipFilter,
    assignedIds,
  });
  const allTags = useFacetedTags(baseMaterials, selectedTags);
  const filteredMaterials = useFilteredMaterials(libraryMaterials, {
    searchQuery,
    selectedTags,
    membershipFilter,
    assignedIds,
  });
  const visibleCollections = useVisibleCollections(collections, collectionSearch);

  const isOverview = activeView === 'overview';
  const shelfLimit = isOverview ? OVERVIEW_STEPS[collectionsLevel] : undefined;
  const materialsLimit = isOverview ? OVERVIEW_STEPS[materialsLevel] : undefined;
  // The shelf search only earns its place once the preview is expanded or the
  // full browser is open — filtering a 6-card preview would lie about counts.
  const showCollectionSearch =
    collections.length > 6 && (activeView === 'collections' || collectionsLevel > 0);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
  }, []);

  const handleCollectionSearchChange = useCallback((value: string) => {
    setCollectionSearch(value);
  }, []);

  const handleOpen = useCallback(
    (material: StudyMaterial) => {
      onOpenMaterial(material.id);
    },
    [onOpenMaterial],
  );

  const handleStartQuiz = useCallback(
    (material: StudyMaterial) => {
      onStartQuiz({ type: 'quiz', quizId: material.id, materialId: material.id, source: 'library' });
    },
    [onStartQuiz],
  );

  const description = formatLibraryDescription(
    materialsLoading,
    libraryMaterials.length,
    collections.length,
  );
  const showViewSwitcher = shouldShowViewSwitcher(
    materialsLoading,
    collectionsLoading,
    libraryMaterials.length,
    collections.length,
  );

  return (
    <>
      <Page
        title="Library"
        description={description}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              label="New Material"
              variant="primary"
              icon={<Plus size={18} />}
              onClick={handleNewMaterial}
            >
              New Material
            </Button>
          </div>
        }
      >
        {showViewSwitcher && (
          <LibraryViewSwitcher activeView={activeView} onViewChange={onViewChange} />
        )}

        <LibraryCollectionsSection
          visible={isOverview || activeView === 'collections'}
          isOverview={isOverview}
          showSearch={showCollectionSearch}
          collectionSearch={collectionSearch}
          onCollectionSearchChange={handleCollectionSearchChange}
          onClearCollectionSearch={() => setCollectionSearch('')}
          visibleCollections={visibleCollections}
          totalCollections={collections.length}
          counts={counts}
          isLoading={collectionsLoading}
          limit={shelfLimit}
          level={collectionsLevel}
          onLevelChange={setCollectionsLevel}
          onOpen={onOpenCollection}
          onCreate={openCreateCollection}
          onViewAll={() => onViewChange('collections')}
        />

        <LibraryMaterialsSection
          visible={isOverview || activeView === 'materials'}
          isOverview={isOverview}
          isLoading={materialsLoading}
          materials={filteredMaterials}
          limit={materialsLimit}
          totalMaterialCount={libraryMaterials.length}
          allTags={allTags}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          selectedTags={selectedTags}
          onToggleTag={handleToggleTag}
          onClearFilters={handleClearFilters}
          membershipFilter={membershipFilter}
          onMembershipFilterChange={onFilterChange}
          onOpen={handleOpen}
          onEdit={handleEditTrigger}
          onDelete={handleDeleteTrigger}
          onStartQuiz={handleStartQuiz}
          onManage={onManage}
          onOpenCollection={onOpenCollection}
          onBrowseAvailable={onBrowseAvailable}
          level={materialsLevel}
          onLevelChange={setMaterialsLevel}
          onViewAll={() => onViewChange('materials')}
        />
      </Page>

      <LibraryModals
        editTarget={editTarget}
        deleteTarget={deleteTarget}
        showCreateMaterial={showCreateMaterial}
        showCreateCollection={showCreateCollection}
        onEditSave={handleEditSave}
        onEditClose={handleEditClose}
        onCreateMaterialSave={handleCreateMaterialSave}
        onCreateMaterialClose={handleCreateMaterialClose}
        onDeleteConfirm={handleDeleteConfirm}
        onDeleteClose={handleDeleteClose}
        onCreateCollectionSave={handleCreateCollectionSave}
        onCreateCollectionClose={handleCreateCollectionClose}
      />
    </>
  );
}

export default LibraryScreen;
