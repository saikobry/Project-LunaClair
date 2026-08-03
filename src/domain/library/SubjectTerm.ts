export interface SubjectTerm {
  subjectId: string;
  termId: string;
  order: number;
}

export interface SubjectTermView {
  term: import('./Term').Term;
  order: number;
}
