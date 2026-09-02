import type { Subject } from '../models/Subject';

export interface CreateSubjectInput {
  title: string;
  description?: string;
  order?: number;
}

export interface UpdateSubjectInput {
  title?: string;
  description?: string;
  order?: number;
}

export interface SubjectRepository {
  getSubjects(signal?: AbortSignal): Promise<Subject[]>;
  getSubjectById(id: string, signal?: AbortSignal): Promise<Subject | null>;
  createSubject(input: CreateSubjectInput): Promise<Subject>;
  updateSubject(id: string, input: UpdateSubjectInput): Promise<Subject>;
  deleteSubject(id: string): Promise<void>;

  /**
   * Batch-reorder subjects in a single operation.
   * `orderedIds` lists every subject ID in its final desired order.
   * Sequential `order` values are assigned automatically.
   */
  reorderSubjects(orderedIds: string[]): Promise<void>;
}
