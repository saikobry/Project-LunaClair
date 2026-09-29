import { describe, it, expect } from 'vitest';
import { validateStudyPackage } from '../validateStudyPackage';
import type { StudyPackage } from '../../models/package.types';
import type { QuestionType } from '../../../quiz/models/QuestionType';

const createValidPackage = (): StudyPackage => ({
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
        title: 'Cell Biology 101',
        description: 'Comprehensive package on cell structure and organelles.',
        author: 'Prof. Bio',
        createdAt: '2026-08-27T00:00:00.000Z',
        appVersion: '1.0.0',
        tags: ['biology', 'science'],
    },
    materials: [
        {
            id: 'pkg_mat_cell_intro',
            title: 'Cell Structure',
            description: 'Introduction to plant and animal cells.',
            documentContent: '# Cell Structure\n\nSee diagram: ![Cell Diagram](lc-asset://pkg_asset_cell_diagram)\n\nEnd of section.',
            order: 1,
            tags: ['biology', 'cells'],
        },
    ],
    questions: [
        {
            id: 'pkg_q_mitochondria',
            materialId: 'pkg_mat_cell_intro',
            type: 'multiple_choice',
            prompt: 'What is the powerhouse of the cell?',
            payload: {
                type: 'multiple_choice',
                choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi'],
                correctIndex: 1,
            },
            difficulty: 'easy',
            points: 5,
            explanation: 'Mitochondria produce ATP.',
            tags: ['organelles'],
        },
        {
            id: 'pkg_q_plant_cell',
            materialId: 'pkg_mat_cell_intro',
            type: 'true_false',
            prompt: 'Plant cells have cell walls.',
            payload: {
                type: 'true_false',
                correctAnswer: true,
            },
            difficulty: 'easy',
            points: 2,
        },
    ],
    quizzes: [
        {
            id: 'pkg_quiz_cell_basics',
            materialId: 'pkg_mat_cell_intro',
            title: 'Cell Basics Quiz',
            description: 'Test your understanding of basic organelles.',
            timeLimitSeconds: 300,
            passingPercentage: 70,
            items: [
                {
                    questionId: 'pkg_q_mitochondria',
                    order: 1,
                    points: 5,
                },
                {
                    questionId: 'pkg_q_plant_cell',
                    order: 2,
                    points: 2,
                },
            ],
        },
    ],
    flashcards: [
        {
            id: 'pkg_card_mitochondria',
            materialId: 'pkg_mat_cell_intro',
            front: 'Mitochondria',
            back: 'Cellular powerhouse producing ATP',
            hints: ['Organelle', 'ATP'],
        },
    ],
    assets: [
        {
            id: 'pkg_asset_cell_diagram',
            filename: 'cell_diagram.png',
            mimeType: 'image/png',
            dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            materialId: 'pkg_mat_cell_intro',
        },
    ],
});

describe('validateStudyPackage', () => {
    it('validates a well-formed complete study package', () => {
        const pkg = createValidPackage();
        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('validates a minimal package without optional flashcards or assets', () => {
        const pkg = createValidPackage();
        delete pkg.flashcards;
        delete pkg.assets;
        pkg.materials[0].documentContent = '# Simple text without assets';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('rejects null, primitives, and non-object inputs', () => {
        expect(validateStudyPackage(null).isValid).toBe(false);
        expect(validateStudyPackage(undefined).isValid).toBe(false);
        expect(validateStudyPackage('invalid string').isValid).toBe(false);
        expect(validateStudyPackage(12345).isValid).toBe(false);
        expect(validateStudyPackage([]).isValid).toBe(false);
    });

    it('rejects invalid format identifier', () => {
        const pkg = { ...createValidPackage(), format: 'other_format' };
        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Invalid package format: expected "lcpack", got "other_format"');
    });

    it('rejects unsupported schema versions', () => {
        const pkg = { ...createValidPackage(), schemaVersion: 2 };
        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Unsupported schema version: expected 1, got "2"');
    });

    it('rejects missing or invalid metadata fields', () => {
        const pkg = createValidPackage();
        pkg.metadata = { title: '', createdAt: '' } as any;

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                'Package metadata "title" must be a non-empty string.',
                'Package metadata "createdAt" must be a valid date string.',
            ])
        );
    });

    it('rejects invalid entity ID prefixes', () => {
        const pkg = createValidPackage();
        (pkg.materials[0] as any).id = 'mat_1';
        (pkg.questions[0] as any).id = 'q_1';
        (pkg.quizzes[0] as any).id = 'quiz_1';
        (pkg.flashcards![0] as any).id = 'card_1';
        (pkg.assets![0] as any).id = 'asset_1';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('pkg_mat_'))).toBe(true);
        expect(result.errors.some(e => e.includes('pkg_q_'))).toBe(true);
        expect(result.errors.some(e => e.includes('pkg_quiz_'))).toBe(true);
        expect(result.errors.some(e => e.includes('pkg_card_'))).toBe(true);
        expect(result.errors.some(e => e.includes('pkg_asset_'))).toBe(true);
    });

    it('detects duplicate IDs across materials and questions', () => {
        const pkg = createValidPackage();
        pkg.materials.push({
            id: 'pkg_mat_cell_intro', // Duplicate material ID
            title: 'Duplicate Cell',
            documentContent: 'Duplicate',
        });

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Duplicate entity ID "pkg_mat_cell_intro" detected in materials (index 1).');
    });

    it('detects duplicate IDs across different entity collections', () => {
        const pkg = createValidPackage();
        // Force question to share ID with material
        (pkg.questions[0] as any).id = 'pkg_mat_cell_intro';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('Duplicate entity ID "pkg_mat_cell_intro"'))).toBe(true);
    });

    it('detects orphaned foreign keys in questions', () => {
        const pkg = createValidPackage();
        pkg.questions[0].materialId = 'pkg_mat_non_existent';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Question "pkg_q_mitochondria" references non-existent material "pkg_mat_non_existent".');
    });

    it('detects orphaned foreign keys in quizzes and quiz items', () => {
        const pkg = createValidPackage();
        pkg.quizzes[0].materialId = 'pkg_mat_ghost';
        pkg.quizzes[0].items[0].questionId = 'pkg_q_ghost';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Quiz "pkg_quiz_cell_basics" references non-existent material "pkg_mat_ghost".');
        expect(result.errors).toContain('Quiz "pkg_quiz_cell_basics" item references non-existent question "pkg_q_ghost".');
    });

    it('detects orphaned foreign keys in flashcards and assets', () => {
        const pkg = createValidPackage();
        pkg.flashcards![0].materialId = 'pkg_mat_ghost';
        pkg.assets![0].materialId = 'pkg_mat_ghost';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Flashcard "pkg_card_mitochondria" references non-existent material "pkg_mat_ghost".');
        expect(result.errors).toContain('Asset "pkg_asset_cell_diagram" references non-existent material "pkg_mat_ghost".');
    });

    it('accepts materials without tags (tags are optional)', () => {
        const pkg = createValidPackage();
        delete (pkg.materials[0] as any).tags;

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('rejects material tags that are not an array of strings', () => {
        const pkg = createValidPackage();
        (pkg.materials[0] as any).tags = 'not-an-array';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Material "pkg_mat_cell_intro" tags must be an array of strings.');
    });

    it('detects undeclared asset references in markdown documentContent', () => {
        const pkg = createValidPackage();
        pkg.materials[0].documentContent = '# Organelles\n\n![Unknown](lc-asset://pkg_asset_missing_photo)';

        const result = validateStudyPackage(pkg);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
            'Material "pkg_mat_cell_intro" references undeclared asset "pkg_asset_missing_photo" in markdown content.'
        );
    });

    /**
     * `sourceSection` is the one field that made it into the package format purely to stop
     * the generator from computing it and throwing it away. It is ADDITIVE and optional, and
     * the compatibility policy is deliberately one-directional: absence is always valid, so
     * every package published before the field existed keeps validating forever.
     */
    describe('question sourceSection (additive, optional)', () => {
        it('accepts a package whose questions carry no sourceSection at all', () => {
            // The compatibility policy, pinned: the base fixture predates the field and is
            // still a valid package. A reader must never be the reason an old share stops cloning.
            const pkg = createValidPackage();
            expect(pkg.questions.every((q) => q.sourceSection === undefined)).toBe(true);

            const result = validateStudyPackage(pkg);
            expect(result.errors).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        it('accepts a string sourceSection', () => {
            const pkg = createValidPackage();
            pkg.questions[0].sourceSection = 'Cell Organelles';

            const result = validateStudyPackage(pkg);
            expect(result.errors).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        it('accepts an empty string as a present-but-empty label', () => {
            // Presence with no content is not a structural defect; the repository's write
            // boundary is what collapses a blank label to absent, not the package validator.
            const pkg = createValidPackage();
            pkg.questions[0].sourceSection = '';

            const result = validateStudyPackage(pkg);
            expect(result.errors).toEqual([]);
        });

        it('rejects a present-but-non-string sourceSection', () => {
            // The one thing that is refused: a value of the wrong shape, which would put a
            // non-label into the provenance field on clone.
            const pkg = createValidPackage();
            (pkg.questions[0] as any).sourceSection = ['Cell Organelles'];

            const result = validateStudyPackage(pkg);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Question "pkg_q_mitochondria" sourceSection must be a string.');
        });
    });

    /**
     * Per-type payload validation is UNCONDITIONAL: a malformed payload is an `error` like any
     * other, on the single tier. There is no option and no tolerance left to opt out of, so a
     * caller cannot forget to ask for strictness — there is nothing to ask for.
     */
    describe('question payload validation (one strict tier)', () => {
        const addMalformedCloze = (pkg: StudyPackage): StudyPackage => {
            pkg.questions.push({
                id: 'pkg_q_broken_cloze',
                materialId: 'pkg_mat_cell_intro',
                type: 'fill_in_blank',
                prompt: 'Fill in the blanks.',
                // Two `___` markers, one answer.
                payload: {
                    type: 'fill_in_blank',
                    template: 'The ___ is the ___ of the cell.',
                    blanks: ['nucleus'],
                },
                difficulty: 'medium',
                points: 1,
            });
            return pkg;
        };

        it('rejects a malformed cloze and names the offending question', () => {
            const pkg = addMalformedCloze(createValidPackage());

            const result = validateStudyPackage(pkg);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                'Question "pkg_q_broken_cloze": fill_in_blank payload requires exactly one answer per "___" placeholder (2 in template, 1 supplied).',
            );
        });

        it('rejects a malformed payload of every one of the five types', () => {
            const malformedByType: Array<[StudyPackage['questions'][number]['type'], unknown]> = [
                [
                    'multiple_choice',
                    { type: 'multiple_choice', choices: ['Only one'], correctIndex: 0 },
                ],
                [
                    'multiple_select',
                    { type: 'multiple_select', choices: ['A', 'B'], correctIndices: [] },
                ],
                ['true_false', { type: 'true_false', correctAnswer: 'yes' }],
                ['identification', { type: 'identification', correctAnswer: '' }],
                [
                    'fill_in_blank',
                    { type: 'fill_in_blank', template: 'The ___ is the ___.', blanks: ['nucleus'] },
                ],
            ];

            for (const [type, payload] of malformedByType) {
                const pkg = createValidPackage();
                pkg.questions.push({
                    id: 'pkg_q_broken',
                    materialId: 'pkg_mat_cell_intro',
                    type,
                    prompt: 'Answer this.',
                    payload: payload as StudyPackage['questions'][number]['payload'],
                    difficulty: 'medium',
                    points: 1,
                });

                const result = validateStudyPackage(pkg);

                expect(result.isValid, type).toBe(false);
                expect(result.errors.length, type).toBeGreaterThan(0);
                // Every finding is attributed to the question that carries it, so a caller can name it.
                for (const error of result.errors) {
                    expect(error, type).toContain('Question "pkg_q_broken": ');
                }
            }
        });

        it('reports a payload whose own type disagrees with the question type', () => {
            const pkg = createValidPackage();
            pkg.questions.push({
                id: 'pkg_q_mismatch',
                materialId: 'pkg_mat_cell_intro',
                type: 'identification',
                prompt: 'Name the organelle.',
                payload: { type: 'true_false', correctAnswer: true },
                difficulty: 'medium',
                points: 1,
            });

            const result = validateStudyPackage(pkg);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain(
                'Question "pkg_q_mismatch": payload.type "true_false" does not match question type "identification".',
            );
            expect(result.errors).toContain(
                'Question "pkg_q_mismatch": identification payload requires a non-empty "correctAnswer" string.',
            );
        });

        it('leaves a structurally sound package error-free', () => {
            const pkg = createValidPackage();

            const result = validateStudyPackage(pkg);

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('keeps sourceSection optional', () => {
            const pkg = createValidPackage();
            expect(pkg.questions.every((q) => q.sourceSection === undefined)).toBe(true);

            const result = validateStudyPackage(pkg);
            expect(result.errors).toEqual([]);
            expect(result.isValid).toBe(true);
        });

        /**
         * The tolerance is gone, so no ingress can produce a payload the study surfaces cannot
         * read. These are the three shapes the defensive guards used to absorb; asserting the
         * validator refuses them is what lets those guards be deleted rather than merely unused.
         */
        it('refuses the three shapes the deleted defensive guards used to absorb', () => {
            const corpus: Array<[QuestionType, unknown]> = [
                ['fill_in_blank', { type: 'fill_in_blank', template: 'A ___ B', blanks: 'not-an-array' }],
                ['fill_in_blank', { type: 'fill_in_blank', template: 42, blanks: ['x'] }],
                ['identification', { type: 'identification', correctAnswer: 'x', acceptedAlternatives: 'Edo' }],
            ];

            for (const [type, payload] of corpus) {
                const pkg = createValidPackage();
                pkg.questions.push({
                    id: 'pkg_q_shape',
                    materialId: 'pkg_mat_cell_intro',
                    type,
                    prompt: 'Answer this.',
                    payload: payload as StudyPackage['questions'][number]['payload'],
                    difficulty: 'medium',
                    points: 1,
                });

                const result = validateStudyPackage(pkg);

                expect(result.isValid, `${type} ${JSON.stringify(payload)}`).toBe(false);
                expect(result.errors.length, `${type} ${JSON.stringify(payload)}`).toBeGreaterThan(0);
            }
        });
    });
});
