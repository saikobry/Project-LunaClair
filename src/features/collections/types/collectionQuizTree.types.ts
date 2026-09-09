export interface CollectionQuizItem {
  id: string;
  materialId: string;
  title: string;
  questionCount: number;
  description?: string;
}

export interface CollectionQuizMaterialGroup {
  materialId: string;
  materialTitle: string;
  quizzes: CollectionQuizItem[];
}
