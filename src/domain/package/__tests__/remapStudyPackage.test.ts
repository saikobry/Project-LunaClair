import { describe, it, expect } from 'vitest';
import { remapStudyPackage } from '../remapStudyPackage';
import type { LocalIdGenerator, StudyPackage } from '../package.types';

const createSamplePackage = (): StudyPackage => ({
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
        title: 'Physics Mechanics',
        description: 'Newtonian mechanics study guide.',
        author: 'Newton',
        createdAt: '2026-08-27T00:00:00.000Z',
    },
    materials: [
        {
            id: 'pkg_mat_newton_laws',
            title: 'Newton\'s Laws',
            description: 'Three fundamental laws of motion.',
            documentContent: '# Newton\'s Laws\n\nDiagram: ![Force](lc-asset://pkg_asset_force_diag)\n\nEnd.',
            order: 1,
        },
    ],
    questions: [
        {
            id: 'pkg_q_first_law',
            materialId: 'pkg_mat_newton_laws',
            type: 'multiple_choice',
            prompt: 'What is the First Law also known as?',
            payload: {
                type: 'multiple_choice',
                choices: ['Law of Inertia', 'Law of Acceleration', 'Law of Gravity', 'Law of Thermodynamics'],
                correctIndex: 0,
            },
            difficulty: 'easy',
            points: 10,
            explanation: 'An object at rest stays at rest unless acted upon by a net external force.',
            tags: ['physics', 'mechanics'],
        },
    ],
    quizzes: [
        {
            id: 'pkg_quiz_mechanics_eval',
            materialId: 'pkg_mat_newton_laws',
            title: 'Mechanics Mastery Quiz',
            description: 'Evaluate your understanding of motion.',
            timeLimitSeconds: 600,
            passingPercentage: 80,
            items: [
                {
                    questionId: 'pkg_q_first_law',
                    order: 1,
                    points: 10,
                },
            ],
        },
    ],
    flashcards: [
        {
            id: 'pkg_card_inertia',
            materialId: 'pkg_mat_newton_laws',
            front: 'Inertia',
            back: 'Resistance of an object to a change in its state of motion.',
            hints: ['Mass related'],
        },
    ],
    assets: [
        {
            id: 'pkg_asset_force_diag',
            filename: 'force_diagram.png',
            mimeType: 'image/png',
            dataBase64: 'AAAA',
            materialId: 'pkg_mat_newton_laws',
        },
    ],
});

class MockIdGenerator implements LocalIdGenerator {
    private counter = 0;
    private readonly prefix: string;

    constructor(prefix = 'local_id') {
        this.prefix = prefix;
    }

    generate(): string {
        this.counter += 1;
        return `${this.prefix}_${this.counter}`;
    }
}

describe('remapStudyPackage', () => {
    it('generates fresh UUIDs and correctly maps all entity relationships using custom generator', () => {
        const pkg = createSamplePackage();
        const generator = new MockIdGenerator('test_uuid');
        const remapped = remapStudyPackage(pkg, generator);

        // Materials remapped
        expect(remapped.materials).toHaveLength(1);
        const remappedMat = remapped.materials[0];
        expect(remappedMat.id).toBe('test_uuid_1');
        expect(remappedMat.documentId).toBe('test_uuid_6'); // 5 package entities mapped (mat, q, quiz, card, asset) then docId generated
        expect(remappedMat.title).toBe(pkg.materials[0].title);

        // Questions remapped with correct FKs
        expect(remapped.questions).toHaveLength(1);
        const remappedQ = remapped.questions[0];
        expect(remappedQ.id).toBe('test_uuid_2');
        expect(remappedQ.materialId).toBe('test_uuid_1');
        expect(remappedQ.points).toBe(10);
        expect(remappedQ.status).toBe('published');
        expect(remappedQ.version).toBe(1);

        // Quizzes remapped with correct FKs
        expect(remapped.quizzes).toHaveLength(1);
        const remappedQuiz = remapped.quizzes[0];
        expect(remappedQuiz.id).toBe('test_uuid_3');
        expect(remappedQuiz.materialId).toBe('test_uuid_1');
        expect(remappedQuiz.questionIds).toEqual(['test_uuid_2']);
        expect(remappedQuiz.items).toHaveLength(1);
        expect(remappedQuiz.items[0]).toEqual({
            quizId: 'test_uuid_3',
            questionId: 'test_uuid_2',
            questionVersion: 1,
            order: 1,
            points: 10,
        });

        // Flashcards remapped with correct FKs
        expect(remapped.flashcards).toHaveLength(1);
        const remappedCard = remapped.flashcards[0];
        expect(remappedCard.id).toBe('test_uuid_4');
        expect(remappedCard.materialId).toBe('test_uuid_1');

        // Assets remapped with correct FKs
        expect(remapped.assets).toHaveLength(1);
        const remappedAsset = remapped.assets[0];
        expect(remappedAsset.id).toBe('test_uuid_5');
        expect(remappedAsset.materialId).toBe('test_uuid_1');

        // Embedded asset URI in markdown is rewritten
        expect(remappedMat.documentContent).toContain('lc-asset://test_uuid_5');
        expect(remappedMat.documentContent).not.toContain('pkg_asset_force_diag');

        // ID map contains all package IDs
        expect(remapped.idMap.get('pkg_mat_newton_laws')).toBe('test_uuid_1');
        expect(remapped.idMap.get('pkg_q_first_law')).toBe('test_uuid_2');
        expect(remapped.idMap.get('pkg_quiz_mechanics_eval')).toBe('test_uuid_3');
        expect(remapped.idMap.get('pkg_card_inertia')).toBe('test_uuid_4');
        expect(remapped.idMap.get('pkg_asset_force_diag')).toBe('test_uuid_5');
    });

    it('generates unique collision-free UUIDs by default', () => {
        const pkg = createSamplePackage();
        const remapped = remapStudyPackage(pkg);

        const allGeneratedIds = [
            ...remapped.materials.map(m => m.id),
            ...remapped.materials.map(m => m.documentId),
            ...remapped.questions.map(q => q.id),
            ...remapped.quizzes.map(qz => qz.id),
            ...remapped.flashcards.map(c => c.id),
            ...remapped.assets.map(a => a.id),
        ];

        const uniqueIds = new Set(allGeneratedIds);
        expect(uniqueIds.size).toBe(allGeneratedIds.length);
    });

    it('produces distinct independent ID mappings on duplicate sequential imports', () => {
        const pkg = createSamplePackage();
        const import1 = remapStudyPackage(pkg);
        const import2 = remapStudyPackage(pkg);

        expect(import1.materials[0].id).not.toBe(import2.materials[0].id);
        expect(import1.questions[0].id).not.toBe(import2.questions[0].id);
        expect(import1.quizzes[0].id).not.toBe(import2.quizzes[0].id);
        expect(import1.assets[0].id).not.toBe(import2.assets[0].id);
    });
});
