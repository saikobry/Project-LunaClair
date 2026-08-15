export interface StudyMaterial {
  id: string;
  title: string;
  description?: string;
  sourceId: string;
  subjectId?: string;
  termId?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}
