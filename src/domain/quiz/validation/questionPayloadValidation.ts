import type { QuestionType } from '../models/QuestionType';

/**
 * Structural validation of a question payload against its declared type — the single owner of
 * "is this payload structurally valid for this type?", covering all five question types.
 *
 * Two callers already enforced a slice of this rule before it lived here
 * (`application/quiz-management/drafts/quizDraftValidation` for authoring and
 * `domain/generator/validation/questionDraftValidation` for AI generation), and a third copy at
 * the persistence boundary was explicitly rejected in favour of one rule with several call sites.
 * The package boundary consumes it too, because a `.lcpack` carries questions authored somewhere
 * else and must be held to the same semantics rather than a divergent rule.
 *
 * **This is now a call site, not just a module: every ingress to `db.questions` validates.**
 * `validateStudyPackage` (import and publish), `CreateQuestionUseCase`/`UpdateQuestionUseCase`
 * (the Question Bank — the one authoring surface that had no validator until Sep 2026),
 * `SaveQuizUseCase` through the authoring draft rules, and `BatchCreateQuestionsUseCase` through
 * `validateQuestionDraft`. That is what makes the defensive guards in the projection, the cloze
 * resolver, the reset predicate and the two strategies unnecessary rather than merely unused.
 *
 * PURITY: no React, no persistence, no `Date`, no randomness — the package validator and the
 * Worker's publish validator both mirror the exact wording produced here. **The wording is a
 * frozen contract**: `worker/src/__tests__/questionPayloadParity.test.ts` fails on any change to
 * a single message, so a rewording is a coordinated edit, never a local one.
 *
 * @returns the structural defects, empty when the payload is valid for the declared type.
 */
export function validateQuestionPayload(
  declaredType: QuestionType,
  payload: unknown,
): string[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return ['payload must be a non-null object.'];
  }

  const raw = payload as Record<string, unknown>;
  const issues: string[] = [];

  // `q.type` and `payload.type` are two statements about the same fact. A payload whose own
  // discriminant disagrees with the question's is malformed even when the payload body happens to
  // parse: consumers dispatch on `payload.type` (`questionToCards`), authors read `q.type`.
  if (raw.type !== declaredType) {
    issues.push(
      `payload.type "${String(raw.type)}" does not match question type "${declaredType}".`,
    );
  }

  switch (declaredType) {
    case 'multiple_choice': {
      const choices = Array.isArray(raw.choices) ? raw.choices : [];
      if (choices.length < 2 || !choices.every(isNonBlankString)) {
        issues.push(
          'multiple_choice payload requires a "choices" array of at least 2 non-empty strings.',
        );
      }
      const correctIndex = raw.correctIndex;
      if (
        typeof correctIndex !== 'number' ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= choices.length
      ) {
        issues.push(
          'multiple_choice payload requires "correctIndex" to be an integer within the choices range.',
        );
      }
      return issues;
    }

    case 'multiple_select': {
      const choices = Array.isArray(raw.choices) ? raw.choices : [];
      if (choices.length < 2 || !choices.every(isNonBlankString)) {
        issues.push(
          'multiple_select payload requires a "choices" array of at least 2 non-empty strings.',
        );
      }
      const correctIndices = raw.correctIndices;
      const hasCorrectAnswers =
        Array.isArray(correctIndices) &&
        correctIndices.length > 0 &&
        correctIndices.every(
          (index) =>
            typeof index === 'number' &&
            Number.isInteger(index) &&
            index >= 0 &&
            index < choices.length,
        );
      // An unanswered question is the same class of defect as a multiple_choice with no
      // determinable correct answer: the payload cannot say what the right answer is.
      if (!hasCorrectAnswers) {
        issues.push(
          'multiple_select payload requires a non-empty "correctIndices" array of integers within the choices range.',
        );
      }
      return issues;
    }

    case 'true_false': {
      if (typeof raw.correctAnswer !== 'boolean') {
        issues.push('true_false payload requires a boolean "correctAnswer".');
      }
      return issues;
    }

    case 'identification': {
      if (!isNonBlankString(raw.correctAnswer)) {
        issues.push('identification payload requires a non-empty "correctAnswer" string.');
      }
      if (
        raw.acceptedAlternatives !== undefined &&
        (!Array.isArray(raw.acceptedAlternatives) ||
          !raw.acceptedAlternatives.every((alternative) => typeof alternative === 'string'))
      ) {
        issues.push(
          'identification payload "acceptedAlternatives" must be an array of strings when provided.',
        );
      }
      return issues;
    }

    case 'fill_in_blank': {
      const template = typeof raw.template === 'string' ? raw.template : '';
      const markerCount = countBlankMarkers(template);

      // The `___` marker IS the question: a template without one has nothing to fill in, and
      // `questionToCards` would fall back to a single whole-question card.
      if (markerCount === 0) {
        issues.push(
          'fill_in_blank payload requires a "template" string with at least one "___" placeholder.',
        );
        return issues;
      }

      const blanks = Array.isArray(raw.blanks) ? raw.blanks : [];
      // Parity is the load-bearing rule — a mismatch is exactly what the projection silently
      // degrades to a whole-question card over. Counts are included so the defect is actionable.
      if (blanks.length !== markerCount) {
        issues.push(
          `fill_in_blank payload requires exactly one answer per "___" placeholder (${markerCount} in template, ${blanks.length} supplied).`,
        );
        return issues;
      }

      if (!blanks.every(isNonBlankString)) {
        issues.push('fill_in_blank payload requires a non-empty answer for every "___" placeholder.');
      }
      return issues;
    }
  }
}

/** How many `___` placeholders a template carries. */
function countBlankMarkers(template: string): number {
  return (template.match(/___/g) ?? []).length;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
