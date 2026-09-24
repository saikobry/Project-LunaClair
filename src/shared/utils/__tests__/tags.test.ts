import { describe, expect, it } from 'vitest';
import {
    splitTagInput,
    tagKey,
    normalizeTags,
    mergeTags,
} from '../tags';

describe('tags domain utilities', () => {
    describe('splitTagInput', () => {
        it('splits comma-separated input and filters out blank tokens', () => {
            const result = splitTagInput('biology,  genetics , , biochemistry,');
            expect(result).toEqual(['biology', 'genetics', 'biochemistry']);
        });

        it('returns empty array on empty or whitespace string', () => {
            expect(splitTagInput('')).toEqual([]);
            expect(splitTagInput('   , , ')).toEqual([]);
        });
    });

    describe('tagKey', () => {
        it('lowercases and trims string for canonical deduplication key', () => {
            expect(tagKey('  iOS Development  ')).toBe('ios development');
            expect(tagKey('BioChem')).toBe('biochem');
        });
    });

    describe('normalizeTags', () => {
        it('preserves first-seen casing while deduplicating case-insensitively', () => {
            const input = ['#React', 'react', '#REACT', 'TypeScript', 'typescript'];
            const result = normalizeTags(input);

            expect(result).toEqual(['React', 'TypeScript']);
        });

        it('strips leading hash characters', () => {
            const input = ['#biology', '#Metabolism', 'genetics'];
            const result = normalizeTags(input);

            expect(result).toEqual(['biology', 'Metabolism', 'genetics']);
        });

        it('returns undefined for undefined, empty array, or tokens that reduce to empty', () => {
            expect(normalizeTags(undefined)).toBeUndefined();
            expect(normalizeTags([])).toBeUndefined();
            expect(normalizeTags(['', '   ', '#', '  #  '])).toBeUndefined();
        });
    });

    describe('mergeTags', () => {
        it('merges existing and incoming tags preserving existing first-seen casing', () => {
            const existing = ['JavaScript', 'HTML'];
            const incoming = ['javascript', '#CSS', 'html'];
            const result = mergeTags(existing, incoming);

            expect(result).toEqual(['JavaScript', 'HTML', 'CSS']);
        });

        it('handles undefined existing tag array gracefully', () => {
            const result = mergeTags(undefined, ['#Rust', 'rust']);
            expect(result).toEqual(['Rust']);
        });
    });
});
