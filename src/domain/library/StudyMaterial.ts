export type MaterialSourceType = 'bundled' | 'local' | 'firebase' | 'url' | 'generated';

export interface StudyMaterial {
  id: string;
  title: string;
  description?: string;
  sourceType: MaterialSourceType;
  sourceId: string;
  subjectId?: string;
  termId?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}
