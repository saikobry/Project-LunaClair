export interface StudyMaterial {
  id: string;
  title: string;
  description?: string;
  documentId: string;
  subjectId?: string;
  termId?: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}
