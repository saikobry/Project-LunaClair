export type MaterialSourceType = 'markdown' | 'json' | 'pdf' | 'generator' | 'importer';

export interface StudyMaterial {
  id: string;
  title: string;
  description?: string;
  sourceType: MaterialSourceType;
  sourceId: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}
