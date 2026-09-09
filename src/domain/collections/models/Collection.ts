export interface Collection {
    id: string;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface CreateCollectionInput {
    title: string;
    description?: string;
    icon?: string;
    color?: string;
}

export interface UpdateCollectionInput {
    title?: string;
    description?: string;
    icon?: string;
    color?: string;
}
