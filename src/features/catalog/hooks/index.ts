// Centralized catalog hook barrel — aggregates all material, subject, and
// term query/mutation hooks. The public `catalog/index.ts` contract curates
// which of these are exported outside the feature.
export {
  useLibraryRepository,
  useLibrary,
  useMaterial,
  useCreateMaterial,
  useDeleteMaterial,
  useEditMaterial,
  useTouchMaterial,
  useAvailableCatalog,
  useImportMaterial,
  useRemoveImportedMaterial,
} from '../materials/hooks';
export {
  useSubject,
  useSubjects,
  useCreateSubject,
  useEditSubject,
  useDeleteSubject,
  useReorderSubjects,
} from '../subjects/hooks';
export {
  useTerms,
  useTerm,
  useTermUsageCounts,
  useSubjectTermUsage,
  useCreateTerm,
  useEditTerm,
  useDeleteTerm,
  useAddSubjectTerm,
  useRemoveSubjectTerm,
  useReorderSubjectTerms,
  useCreateAndAssignTerm,
} from '../terms/hooks';
