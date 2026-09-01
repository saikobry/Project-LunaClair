import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TriggerSyncUseCase } from '../TriggerSyncUseCase';
import type { SyncEngine } from '../../../sync/SyncEngine';
import type { SessionCredentials, SessionCredentialsProvider } from '../../../../domain/sync';

describe('TriggerSyncUseCase', () => {
    let mockSyncEngine: SyncEngine;

    beforeEach(() => {
        mockSyncEngine = {
            sync: vi.fn().mockResolvedValue(undefined),
        } as unknown as SyncEngine;
    });

    it('triggers sync directly with passed credentials', async () => {
        const creds: SessionCredentials = {
            userId: 'user_direct_1',
            deviceId: 'device_direct_1',
            token: 'token_direct_1',
        };

        const useCase = new TriggerSyncUseCase(mockSyncEngine);
        await useCase.execute({ credentials: creds });

        expect(mockSyncEngine.sync).toHaveBeenCalledWith(creds);
    });

    it('resolves credentials from SessionCredentialsProvider when not explicitly provided', async () => {
        const creds: SessionCredentials = {
            userId: 'user_from_provider',
            deviceId: 'device_from_provider',
            token: 'token_from_provider',
        };

        const mockProvider: SessionCredentialsProvider = {
            getCredentials: vi.fn().mockResolvedValue(creds),
            setCredentials: vi.fn(),
            clearCredentials: vi.fn(),
        };

        const useCase = new TriggerSyncUseCase(mockSyncEngine, mockProvider);
        await useCase.execute();

        expect(mockProvider.getCredentials).toHaveBeenCalled();
        expect(mockSyncEngine.sync).toHaveBeenCalledWith(creds);
    });

    it('throws error when no credentials are provided and provider returns null', async () => {
        const mockProvider: SessionCredentialsProvider = {
            getCredentials: vi.fn().mockResolvedValue(null),
            setCredentials: vi.fn(),
            clearCredentials: vi.fn(),
        };

        const useCase = new TriggerSyncUseCase(mockSyncEngine, mockProvider);
        await expect(useCase.execute()).rejects.toThrow(/No session credentials available/i);
    });
});
