import React, { createContext } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useContextOrThrow } from '../contextGuard';

describe('useContextOrThrow', () => {
    interface MockServiceContextValue {
        name: string;
        performAction: () => void;
    }

    const MockServiceContext = createContext<MockServiceContextValue | null>(null);

    it('throws a descriptive error when called outside of a provider', () => {
        expect(() => {
            renderHook(() => useContextOrThrow(MockServiceContext, 'useMockService'));
        }).toThrowError('useMockService must be used within a <ApplicationProvider>');
    });

    it('throws a descriptive error when provider value is explicitly null', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(MockServiceContext.Provider, { value: null }, children);

        expect(() => {
            renderHook(() => useContextOrThrow(MockServiceContext, 'useMockService'), { wrapper });
        }).toThrowError('useMockService must be used within a <ApplicationProvider>');
    });

    it('returns unwrapped context value when rendered within a valid provider', () => {
        const mockValue: MockServiceContextValue = {
            name: 'ActiveLunaClairService',
            performAction: () => {},
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(MockServiceContext.Provider, { value: mockValue }, children);

        const { result } = renderHook(() => useContextOrThrow(MockServiceContext, 'useMockService'), {
            wrapper,
        });

        expect(result.current).toBe(mockValue);
        expect(result.current.name).toBe('ActiveLunaClairService');
    });
});
