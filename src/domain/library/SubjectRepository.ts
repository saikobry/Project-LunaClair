import type { Subject } from './Subject';

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
}
