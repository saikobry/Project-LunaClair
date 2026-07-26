import type { StudyMaterial } from '../library/StudyMaterial';
import type { Document } from './Document';

export interface DocumentRepository {
    getDocumentByMaterial(
        material: StudyMaterial,
        signal?: AbortSignal,
    ): Promise<Document>;
}
