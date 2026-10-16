import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TriggerSyncUseCase } from '../TriggerSyncUseCase';
import type { SyncEngine } from '../../../sync/SyncEngine';
import type { SessionCredentials } from '../../../../domain/sync/models/sync.types';
import type { SessionCredentialsProvider } from '../../../../domain/sync/services/SessionCredentialsProvider';

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

    it('calls syncEngine.sync(null) when credentials are null or provider returns null', async () => {
        const mockProvider: SessionCredentialsProvider = {
            getCredentials: vi.fn().mockResolvedValue(null),
            setCredentials: vi.fn(),
            clearCredentials: vi.fn(),
        };

        const useCase = new TriggerSyncUseCase(mockSyncEngine, mockProvider);
        await useCase.execute();

        expect(mockSyncEngine.sync).toHaveBeenCalledWith(null);
    });

    it('calls syncEngine.sync(null) when neither credentials nor provider is provided', async () => {
        const useCase = new TriggerSyncUseCase(mockSyncEngine);
        await useCase.execute();

        expect(mockSyncEngine.sync).toHaveBeenCalledWith(null);
    });
});
