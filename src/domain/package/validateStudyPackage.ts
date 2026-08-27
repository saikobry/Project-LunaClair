import type { PackageValidationResult, StudyPackage } from './package.types';
import type { QuestionType } from '../quiz/QuestionType';
import type { QuestionDifficulty } from '../quiz/Question';

const VALID_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([
    'multiple_choice',
    'multiple_select',
    'true_false',
    'identification',
    'fill_in_blank',
]);

const VALID_DIFFICULTIES: ReadonlySet<QuestionDifficulty> = new Set([
    'easy',
    'medium',
    'hard',
]);

const MATERIAL_ID_REGEX = /^pkg_mat_[a-zA-Z0-9_-]+$/;
const QUESTION_ID_REGEX = /^pkg_q_[a-zA-Z0-9_-]+$/;
const QUIZ_ID_REGEX = /^pkg_quiz_[a-zA-Z0-9_-]+$/;
const FLASHCARD_ID_REGEX = /^pkg_card_[a-zA-Z0-9_-]+$/;
const ASSET_ID_REGEX = /^pkg_asset_[a-zA-Z0-9_-]+$/;
const ASSET_URI_REGEX = /lc-asset:\/\/([^\s)"'>]+)/g;

/**
 * Pure validator for checking the structural and referential integrity of a StudyPackage.
 * 
 * Invariants enforced:
 * - format must equal 'lcpack'
 * - schemaVersion must equal 1
 * - Entity IDs must strictly match their canonical prefixes (pkg_mat_, pkg_q_, pkg_quiz_, pkg_card_, pkg_asset_)
 * - No duplicate IDs across any entities in the package
 * - Foreign keys (question.materialId, quiz.materialId, quizItem.questionId, flashcard.materialId, asset.materialId)
 *   must resolve to declared entities
 * - Markdown asset URIs (lc-asset://...) must resolve to declared package assets
 */
export function validateStudyPackage(input: unknown): PackageValidationResult {
    const errors: string[] = [];

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return {
            isValid: false,
            errors: ['Study package must be a non-null object.'],
        };
    }

    const raw = input as Partial<StudyPackage> & Record<string, unknown>;

    // 1. Format and version validation
    if (raw.format !== 'lcpack') {
        errors.push(`Invalid package format: expected "lcpack", got "${String(raw.format)}"`);
    }

    if (raw.schemaVersion !== 1) {
        errors.push(`Unsupported schema version: expected 1, got "${String(raw.schemaVersion)}"`);
    }

    // 2. Metadata validation
    if (!raw.metadata || typeof raw.metadata !== 'object' || Array.isArray(raw.metadata)) {
        errors.push('Package "metadata" must be a non-null object.');
    } else {
        const meta = raw.metadata;
        if (typeof meta.title !== 'string' || meta.title.trim().length === 0) {
            errors.push('Package metadata "title" must be a non-empty string.');
        }
        if (typeof meta.createdAt !== 'string' || meta.createdAt.trim().length === 0) {
            errors.push('Package metadata "createdAt" must be a valid date string.');
        }
        if (meta.description !== undefined && typeof meta.description !== 'string') {
            errors.push('Package metadata "description" must be a string if provided.');
        }
        if (meta.author !== undefined && typeof meta.author !== 'string') {
            errors.push('Package metadata "author" must be a string if provided.');
        }
        if (meta.appVersion !== undefined && typeof meta.appVersion !== 'string') {
            errors.push('Package metadata "appVersion" must be a string if provided.');
        }
        if (meta.tags !== undefined && (!Array.isArray(meta.tags) || meta.tags.some(t => typeof t !== 'string'))) {
            errors.push('Package metadata "tags" must be an array of strings if provided.');
        }
    }

    // Track all seen entity IDs to guarantee package-wide ID uniqueness
    const seenEntityIds = new Set<string>();
    const declaredMaterialIds = new Set<string>();
    const declaredQuestionIds = new Set<string>();
    const declaredAssetIds = new Set<string>();

    const checkUniqueId = (id: string, entityDescription: string): boolean => {
        if (seenEntityIds.has(id)) {
            errors.push(`Duplicate entity ID "${id}" detected in ${entityDescription}.`);
            return false;
        }
        seenEntityIds.add(id);
        return true;
    };

    // 3. Materials validation
    if (!Array.isArray(raw.materials)) {
        errors.push('Package "materials" must be an array.');
    } else {
        raw.materials.forEach((mat, idx) => {
            if (!mat || typeof mat !== 'object' || Array.isArray(mat)) {
                errors.push(`Material at index ${idx} must be an object.`);
                return;
            }
            if (typeof mat.id !== 'string') {
                errors.push(`Material at index ${idx} has invalid ID "${String(mat.id)}": must match "pkg_mat_<id>".`);
            } else {
                checkUniqueId(mat.id, `materials (index ${idx})`);
                if (!MATERIAL_ID_REGEX.test(mat.id)) {
                    errors.push(`Material at index ${idx} has invalid ID "${mat.id}": must match "pkg_mat_<id>".`);
                } else {
                    declaredMaterialIds.add(mat.id);
                }
            }

            if (typeof mat.title !== 'string' || mat.title.trim().length === 0) {
                errors.push(`Material "${String(mat.id || idx)}" must have a non-empty title.`);
            }
            if (typeof mat.documentContent !== 'string') {
                errors.push(`Material "${String(mat.id || idx)}" must have a documentContent string.`);
            }
            if (mat.description !== undefined && typeof mat.description !== 'string') {
                errors.push(`Material "${String(mat.id || idx)}" description must be a string.`);
            }
            if (mat.order !== undefined && (typeof mat.order !== 'number' || Number.isNaN(mat.order))) {
                errors.push(`Material "${String(mat.id || idx)}" order must be a valid number.`);
            }
        });
    }

    // 4. Questions validation
    if (!Array.isArray(raw.questions)) {
        errors.push('Package "questions" must be an array.');
    } else {
        raw.questions.forEach((q, idx) => {
            if (!q || typeof q !== 'object' || Array.isArray(q)) {
                errors.push(`Question at index ${idx} must be an object.`);
                return;
            }
            if (typeof q.id !== 'string') {
                errors.push(`Question at index ${idx} has invalid ID "${String(q.id)}": must match "pkg_q_<id>".`);
            } else {
                checkUniqueId(q.id, `questions (index ${idx})`);
                if (!QUESTION_ID_REGEX.test(q.id)) {
                    errors.push(`Question at index ${idx} has invalid ID "${q.id}": must match "pkg_q_<id>".`);
                } else {
                    declaredQuestionIds.add(q.id);
                }
            }

            if (typeof q.materialId !== 'string' || !MATERIAL_ID_REGEX.test(q.materialId)) {
                errors.push(`Question "${String(q.id || idx)}" has invalid materialId "${String(q.materialId)}".`);
            }

            if (typeof q.type !== 'string' || !VALID_QUESTION_TYPES.has(q.type as QuestionType)) {
                errors.push(`Question "${String(q.id || idx)}" has invalid type "${String(q.type)}".`);
            }

            if (typeof q.prompt !== 'string') {
                errors.push(`Question "${String(q.id || idx)}" must have a prompt string.`);
            }

            if (!q.payload || typeof q.payload !== 'object' || Array.isArray(q.payload)) {
                errors.push(`Question "${String(q.id || idx)}" must have a valid payload object.`);
            }

            if (typeof q.difficulty !== 'string' || !VALID_DIFFICULTIES.has(q.difficulty as QuestionDifficulty)) {
                errors.push(`Question "${String(q.id || idx)}" has invalid difficulty "${String(q.difficulty)}".`);
            }

            if (typeof q.points !== 'number' || Number.isNaN(q.points) || q.points < 0) {
                errors.push(`Question "${String(q.id || idx)}" points must be a non-negative number.`);
            }

            if (q.explanation !== undefined && typeof q.explanation !== 'string') {
                errors.push(`Question "${String(q.id || idx)}" explanation must be a string.`);
            }

            if (q.tags !== undefined && (!Array.isArray(q.tags) || q.tags.some(t => typeof t !== 'string'))) {
                errors.push(`Question "${String(q.id || idx)}" tags must be an array of strings.`);
            }
        });
    }

    // 5. Quizzes validation
    if (!Array.isArray(raw.quizzes)) {
        errors.push('Package "quizzes" must be an array.');
    } else {
        raw.quizzes.forEach((quiz, idx) => {
            if (!quiz || typeof quiz !== 'object' || Array.isArray(quiz)) {
                errors.push(`Quiz at index ${idx} must be an object.`);
                return;
            }
            if (typeof quiz.id !== 'string') {
                errors.push(`Quiz at index ${idx} has invalid ID "${String(quiz.id)}": must match "pkg_quiz_<id>".`);
            } else {
                checkUniqueId(quiz.id, `quizzes (index ${idx})`);
                if (!QUIZ_ID_REGEX.test(quiz.id)) {
                    errors.push(`Quiz at index ${idx} has invalid ID "${quiz.id}": must match "pkg_quiz_<id>".`);
                }
            }

            if (typeof quiz.materialId !== 'string' || !MATERIAL_ID_REGEX.test(quiz.materialId)) {
                errors.push(`Quiz "${String(quiz.id || idx)}" has invalid materialId "${String(quiz.materialId)}".`);
            }

            if (typeof quiz.title !== 'string' || quiz.title.trim().length === 0) {
                errors.push(`Quiz "${String(quiz.id || idx)}" must have a non-empty title.`);
            }

            if (quiz.description !== undefined && typeof quiz.description !== 'string') {
                errors.push(`Quiz "${String(quiz.id || idx)}" description must be a string.`);
            }

            if (quiz.timeLimitSeconds !== undefined && (typeof quiz.timeLimitSeconds !== 'number' || quiz.timeLimitSeconds < 0)) {
                errors.push(`Quiz "${String(quiz.id || idx)}" timeLimitSeconds must be a non-negative number.`);
            }

            if (quiz.passingPercentage !== undefined && (typeof quiz.passingPercentage !== 'number' || quiz.passingPercentage < 0 || quiz.passingPercentage > 100)) {
                errors.push(`Quiz "${String(quiz.id || idx)}" passingPercentage must be a number between 0 and 100.`);
            }

            if (!Array.isArray(quiz.items)) {
                errors.push(`Quiz "${String(quiz.id || idx)}" items must be an array.`);
            } else {
                quiz.items.forEach((item, itemIdx) => {
                    if (!item || typeof item !== 'object' || Array.isArray(item)) {
                        errors.push(`Quiz "${String(quiz.id || idx)}" item at index ${itemIdx} must be an object.`);
                        return;
                    }
                    if (typeof item.questionId !== 'string' || !QUESTION_ID_REGEX.test(item.questionId)) {
                        errors.push(`Quiz "${String(quiz.id || idx)}" item at index ${itemIdx} has invalid questionId "${String(item.questionId)}".`);
                    }
                    if (typeof item.order !== 'number' || Number.isNaN(item.order)) {
                        errors.push(`Quiz "${String(quiz.id || idx)}" item at index ${itemIdx} must have a valid order number.`);
                    }
                    if (item.points !== undefined && (typeof item.points !== 'number' || Number.isNaN(item.points) || item.points < 0)) {
                        errors.push(`Quiz "${String(quiz.id || idx)}" item at index ${itemIdx} points must be a non-negative number.`);
                    }
                });
            }
        });
    }

    // 6. Flashcards validation (optional)
    if (raw.flashcards !== undefined) {
        if (!Array.isArray(raw.flashcards)) {
            errors.push('Package "flashcards" must be an array if provided.');
        } else {
            raw.flashcards.forEach((card, idx) => {
                if (!card || typeof card !== 'object' || Array.isArray(card)) {
                    errors.push(`Flashcard at index ${idx} must be an object.`);
                    return;
                }
                if (typeof card.id !== 'string') {
                    errors.push(`Flashcard at index ${idx} has invalid ID "${String(card.id)}": must match "pkg_card_<id>".`);
                } else {
                    checkUniqueId(card.id, `flashcards (index ${idx})`);
                    if (!FLASHCARD_ID_REGEX.test(card.id)) {
                        errors.push(`Flashcard at index ${idx} has invalid ID "${card.id}": must match "pkg_card_<id>".`);
                    }
                }

                if (typeof card.materialId !== 'string' || !MATERIAL_ID_REGEX.test(card.materialId)) {
                    errors.push(`Flashcard "${String(card.id || idx)}" has invalid materialId "${String(card.materialId)}".`);
                }

                if (typeof card.front !== 'string') {
                    errors.push(`Flashcard "${String(card.id || idx)}" front must be a string.`);
                }
                if (typeof card.back !== 'string') {
                    errors.push(`Flashcard "${String(card.id || idx)}" back must be a string.`);
                }
                if (card.hints !== undefined && (!Array.isArray(card.hints) || card.hints.some(h => typeof h !== 'string'))) {
                    errors.push(`Flashcard "${String(card.id || idx)}" hints must be an array of strings.`);
                }
            });
        }
    }

    // 7. Assets validation (optional)
    if (raw.assets !== undefined) {
        if (!Array.isArray(raw.assets)) {
            errors.push('Package "assets" must be an array if provided.');
        } else {
            raw.assets.forEach((asset, idx) => {
                if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
                    errors.push(`Asset at index ${idx} must be an object.`);
                    return;
                }
                if (typeof asset.id !== 'string') {
                    errors.push(`Asset at index ${idx} has invalid ID "${String(asset.id)}": must match "pkg_asset_<id>".`);
                } else {
                    checkUniqueId(asset.id, `assets (index ${idx})`);
                    if (!ASSET_ID_REGEX.test(asset.id)) {
                        errors.push(`Asset at index ${idx} has invalid ID "${asset.id}": must match "pkg_asset_<id>".`);
                    } else {
                        declaredAssetIds.add(asset.id);
                    }
                }

                if (typeof asset.filename !== 'string' || asset.filename.trim().length === 0) {
                    errors.push(`Asset "${String(asset.id || idx)}" must have a non-empty filename.`);
                }
                if (typeof asset.mimeType !== 'string' || asset.mimeType.trim().length === 0) {
                    errors.push(`Asset "${String(asset.id || idx)}" must have a non-empty mimeType.`);
                }
                if (typeof asset.dataBase64 !== 'string') {
                    errors.push(`Asset "${String(asset.id || idx)}" must have a dataBase64 string.`);
                }
                if (asset.materialId !== undefined && (typeof asset.materialId !== 'string' || !MATERIAL_ID_REGEX.test(asset.materialId))) {
                    errors.push(`Asset "${String(asset.id || idx)}" has invalid materialId "${String(asset.materialId)}".`);
                }
            });
        }
    }

    // 8. Referential Integrity Checks (Foreign Keys)
    // 8a. Questions -> Materials
    if (Array.isArray(raw.questions)) {
        raw.questions.forEach((q) => {
            if (q && typeof q.materialId === 'string' && !declaredMaterialIds.has(q.materialId)) {
                errors.push(`Question "${q.id}" references non-existent material "${q.materialId}".`);
            }
        });
    }

    // 8b. Quizzes -> Materials and Quiz Items -> Questions
    if (Array.isArray(raw.quizzes)) {
        raw.quizzes.forEach((quiz) => {
            if (quiz && typeof quiz.materialId === 'string' && !declaredMaterialIds.has(quiz.materialId)) {
                errors.push(`Quiz "${quiz.id}" references non-existent material "${quiz.materialId}".`);
            }
            if (quiz && Array.isArray(quiz.items)) {
                quiz.items.forEach((item) => {
                    if (item && typeof item.questionId === 'string' && !declaredQuestionIds.has(item.questionId)) {
                        errors.push(`Quiz "${quiz.id}" item references non-existent question "${item.questionId}".`);
                    }
                });
            }
        });
    }

    // 8c. Flashcards -> Materials
    if (Array.isArray(raw.flashcards)) {
        raw.flashcards.forEach((card) => {
            if (card && typeof card.materialId === 'string' && !declaredMaterialIds.has(card.materialId)) {
                errors.push(`Flashcard "${card.id}" references non-existent material "${card.materialId}".`);
            }
        });
    }

    // 8d. Assets -> Materials (if materialId specified)
    if (Array.isArray(raw.assets)) {
        raw.assets.forEach((asset) => {
            if (asset && typeof asset.materialId === 'string' && !declaredMaterialIds.has(asset.materialId)) {
                errors.push(`Asset "${asset.id}" references non-existent material "${asset.materialId}".`);
            }
        });
    }

    // 8e. Markdown Asset References (lc-asset://...) -> Assets
    if (Array.isArray(raw.materials)) {
        raw.materials.forEach((mat) => {
            if (mat && typeof mat.documentContent === 'string') {
                const regex = new RegExp(ASSET_URI_REGEX.source, ASSET_URI_REGEX.flags);
                let match: RegExpExecArray | null;
                while ((match = regex.exec(mat.documentContent)) !== null) {
                    const referencedAssetId = match[1];
                    if (!declaredAssetIds.has(referencedAssetId)) {
                        errors.push(`Material "${mat.id}" references undeclared asset "${referencedAssetId}" in markdown content.`);
                    }
                }
            }
        });
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
}
