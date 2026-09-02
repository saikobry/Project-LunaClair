import type { StudyMaterial } from '../../library/models/StudyMaterial';
import type { Document } from '../models/Document';

export interface DocumentRepository {
    getDocumentByMaterial(
        material: StudyMaterial,
        signal?: AbortSignal,
    ): Promise<Document>;
}
