import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableListKeys } from '../useStableListKeys';

describe('useStableListKeys', () => {
    it('returns empty array when items list is empty', () => {
        const { result } = renderHook(() => useStableListKeys([]));
        expect(result.current).toEqual([]);
    });

    it('returns unique keys matching items length on initialization', () => {
        const items = ['Item 1', 'Item 2', 'Item 3'];
        const { result } = renderHook(() => useStableListKeys(items));

        expect(result.current).toHaveLength(3);
        // All keys must be unique strings
        const uniqueKeys = new Set(result.current);
        expect(uniqueKeys.size).toBe(3);
    });

    it('preserves keys by position when length is unchanged (in-place text edits)', () => {
        const { result, rerender } = renderHook(
            (items: string[]) => useStableListKeys(items),
            {
                initialProps: ['Apple', 'Banana', 'Cherry'],
            },
        );

        const initialKeys = [...result.current];

        // User edits the text of 'Banana' to 'Blueberry' (same length array)
        rerender(['Apple', 'Blueberry', 'Cherry']);

        expect(result.current).toHaveLength(3);
        expect(result.current[0]).toBe(initialKeys[0]);
        expect(result.current[1]).toBe(initialKeys[1]); // Same positional key preserved
        expect(result.current[2]).toBe(initialKeys[2]);
    });

    it('preserves keys for surviving items when an item is appended', () => {
        const { result, rerender } = renderHook(
            (items: string[]) => useStableListKeys(items),
            {
                initialProps: ['First', 'Second'],
            },
        );

        const initialKeys = [...result.current];

        // Append a third item (length increases)
        rerender(['First', 'Second', 'Third']);

        expect(result.current).toHaveLength(3);
        expect(result.current[0]).toBe(initialKeys[0]);
        expect(result.current[1]).toBe(initialKeys[1]);
        expect(result.current[2]).not.toBe(initialKeys[0]);
        expect(result.current[2]).not.toBe(initialKeys[1]);
    });

    it('preserves keys for surviving items when an item is inserted in the middle', () => {
        const { result, rerender } = renderHook(
            (items: string[]) => useStableListKeys(items),
            {
                initialProps: ['First', 'Third'],
            },
        );

        const [keyFirst, keyThird] = result.current;

        // Insert 'Second' in between
        rerender(['First', 'Second', 'Third']);

        expect(result.current).toHaveLength(3);
        expect(result.current[0]).toBe(keyFirst);
        expect(result.current[2]).toBe(keyThird);
        // 'Second' has a newly minted key
        expect(result.current[1]).not.toBe(keyFirst);
        expect(result.current[1]).not.toBe(keyThird);
    });

    it('preserves keys for surviving items when an item is removed', () => {
        const { result, rerender } = renderHook(
            (items: string[]) => useStableListKeys(items),
            {
                initialProps: ['Alpha', 'Beta', 'Gamma'],
            },
        );

        const [keyAlpha, , keyGamma] = result.current;

        // Remove 'Beta'
        rerender(['Alpha', 'Gamma']);

        expect(result.current).toHaveLength(2);
        expect(result.current[0]).toBe(keyAlpha);
        expect(result.current[1]).toBe(keyGamma);
    });

    it('assigns distinct unique keys to duplicate text entries without collision', () => {
        const { result, rerender } = renderHook(
            (items: string[]) => useStableListKeys(items),
            {
                initialProps: ['Duplicate', 'Duplicate', 'Unique'],
            },
        );

        expect(result.current).toHaveLength(3);
        const [dup1Key, dup2Key, uniqueKey] = result.current;
        expect(dup1Key).not.toBe(dup2Key);
        expect(dup1Key).not.toBe(uniqueKey);
        expect(dup2Key).not.toBe(uniqueKey);

        // Appending another item: length changes, 1-to-1 match via used set should still assign unique keys
        rerender(['Duplicate', 'Duplicate', 'Unique', 'Appended']);

        expect(result.current).toHaveLength(4);
        expect(result.current[0]).toBe(dup1Key);
        expect(result.current[1]).toBe(dup2Key);
        expect(result.current[2]).toBe(uniqueKey);
        expect(new Set(result.current).size).toBe(4);
    });

    it('returns the same key array reference when passed the identical array reference', () => {
        const stableArray = ['One', 'Two'];
        const { result, rerender } = renderHook(
            (items: string[]) => useStableListKeys(items),
            {
                initialProps: stableArray,
            },
        );

        const firstKeys = result.current;
        rerender(stableArray);
        const secondKeys = result.current;

        expect(secondKeys).toEqual(firstKeys);
    });
});
