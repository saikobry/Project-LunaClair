import type { StudyMaterial } from '../models/StudyMaterial';

export interface CreateMaterialInput {
  title: string;
  description?: string;
  documentId?: string;
  order?: number;
  tags?: string[];
}

export interface UpdateMaterialInput {
  title?: string;
  description?: string;
  lastOpenedAt?: string;
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
