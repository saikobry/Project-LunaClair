export interface Quiz {
    id: string;
    materialId: string;
    title: string;
    description?: string;
    questionIds: string[];
    timeLimitSeconds?: number;
    passingPercentage?: number;
    createdAt: string;
    updatedAt: string;
}
