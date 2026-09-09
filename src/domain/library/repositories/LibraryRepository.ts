import type { StudyMaterial } from '../models/StudyMaterial';

export interface CreateMaterialInput {
  title: string;
  description?: string;
  documentId?: string;
  subjectId?: string;
  termId?: string;
  order?: number;
  tags?: string[];
}

export interface UpdateMaterialInput {
  title?: string;
  description?: string;
  lastOpenedAt?: string;
  subjectId?: string | null;
  termId?: string | null;
  /** Tags are normalized at the write boundary; an empty array clears tags, undefined leaves them unchanged. */
  tags?: string[];
}

export interface LibraryRepository {
  getMaterials(signal?: AbortSignal): Promise<StudyMaterial[]>;
  getMaterialById(id: string, signal?: AbortSignal): Promise<StudyMaterial | null>;
  createMaterial(input: CreateMaterialInput): Promise<StudyMaterial>;
  updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial>;
  deleteMaterial(id: string): Promise<void>;
}
