import type { StudyMaterial } from './StudyMaterial';

export interface CreateMaterialInput {
  title: string;
  description?: string;
}

export interface UpdateMaterialInput {
  title?: string;
  description?: string;
  lastOpenedAt?: string;
}

export interface LibraryRepository {
  getMaterials(signal?: AbortSignal): Promise<StudyMaterial[]>;
  getMaterialById(id: string, signal?: AbortSignal): Promise<StudyMaterial | null>;
  createMaterial(input: CreateMaterialInput): Promise<StudyMaterial>;
  updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial>;
  deleteMaterial(id: string): Promise<void>;
}
