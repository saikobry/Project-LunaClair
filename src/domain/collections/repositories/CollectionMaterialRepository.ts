import type { CollectionMaterial } from '../models/CollectionMaterial';

export interface CollectionMaterialRepository {
    getByCollectionId(collectionId: string, signal?: AbortSignal): Promise<CollectionMaterial[]>;
    getByMaterialId(materialId: string, signal?: AbortSignal): Promise<CollectionMaterial[]>;
    add(collectionId: string, materialId: string, order?: number): Promise<CollectionMaterial>;
    remove(collectionId: string, materialId: string): Promise<void>;
    reorder(collectionId: string, orderedMaterialIds: string[]): Promise<void>;
    removeByCollectionId(collectionId: string): Promise<void>;
    removeByMaterialId(materialId: string): Promise<void>;
}
