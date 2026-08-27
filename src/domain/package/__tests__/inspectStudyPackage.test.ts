import { describe, it, expect } from 'vitest';
import { inspectStudyPackage } from '../inspectStudyPackage';
import type { StudyPackage } from '../package.types';

describe('inspectStudyPackage', () => {
    it('summarizes metrics and question type breakdown correctly', () => {
        const pkg: StudyPackage = {
            format: 'lcpack',
            schemaVersion: 1,
            metadata: {
                title: 'Data Structures',
                description: 'Trees and Graphs',
                author: 'CS Dept',
                createdAt: '2026-08-27T00:00:00.000Z',
            },
            materials: [
                {
                    id: 'pkg_mat_ds_1',
                    title: 'Binary Trees',
                    documentContent: '# Trees',
                },
                {
                    id: 'pkg_mat_ds_2',
                    title: 'Graphs',
                    documentContent: '# Graphs',
                },
            ],
            questions: [
                {
                    id: 'pkg_q_1',
                    materialId: 'pkg_mat_ds_1',
                    type: 'multiple_choice',
                    prompt: 'Tree traversal question',
                    payload: { type: 'multiple_choice', choices: ['A', 'B'], correctIndex: 0 },
                    difficulty: 'easy',
                    points: 5,
                },
                {
                    id: 'pkg_q_2',
                    materialId: 'pkg_mat_ds_1',
                    type: 'multiple_choice',
                    prompt: 'Binary search tree question',
                    payload: { type: 'multiple_choice', choices: ['C', 'D'], correctIndex: 1 },
                    difficulty: 'medium',
                    points: 10,
                },
                {
                    id: 'pkg_q_3',
                    materialId: 'pkg_mat_ds_2',
                    type: 'true_false',
                    prompt: 'Graph cycle question',
                    payload: { type: 'true_false', correctAnswer: true },
                    difficulty: 'hard',
                    points: 15,
                },
            ],
            quizzes: [
                {
                    id: 'pkg_quiz_1',
                    materialId: 'pkg_mat_ds_1',
                    title: 'DS Quiz',
                    items: [
                        { questionId: 'pkg_q_1', order: 1, points: 5 },
                        { questionId: 'pkg_q_2', order: 2, points: 10 },
                    ],
                },
            ],
            flashcards: [
                {
                    id: 'pkg_card_1',
                    materialId: 'pkg_mat_ds_1',
                    front: 'BST',
                    back: 'Binary Search Tree',
                },
            ],
            assets: [
                {
                    id: 'pkg_asset_1',
                    filename: 'bst.png',
                    mimeType: 'image/png',
                    dataBase64: 'base64',
                },
            ],
        };

        const summary = inspectStudyPackage(pkg);

        expect(summary.title).toBe('Data Structures');
        expect(summary.description).toBe('Trees and Graphs');
        expect(summary.author).toBe('CS Dept');
        expect(summary.createdAt).toBe('2026-08-27T00:00:00.000Z');
        expect(summary.materialCount).toBe(2);
        expect(summary.questionCount).toBe(3);
        expect(summary.quizCount).toBe(1);
        expect(summary.flashcardCount).toBe(1);
        expect(summary.assetCount).toBe(1);
        expect(summary.questionsByType).toEqual({
            multiple_choice: 2,
            true_false: 1,
        });
        expect(summary.totalPoints).toBe(30);
    });

    it('handles packages with missing optional arrays gracefully', () => {
        const pkg: StudyPackage = {
            format: 'lcpack',
            schemaVersion: 1,
            metadata: {
                title: 'Empty Package',
                createdAt: '2026-08-27T00:00:00.000Z',
            },
            materials: [],
            questions: [],
            quizzes: [],
        };

        const summary = inspectStudyPackage(pkg);

        expect(summary.materialCount).toBe(0);
        expect(summary.questionCount).toBe(0);
        expect(summary.quizCount).toBe(0);
        expect(summary.flashcardCount).toBe(0);
        expect(summary.assetCount).toBe(0);
        expect(summary.questionsByType).toEqual({});
        expect(summary.totalPoints).toBe(0);
    });
});
