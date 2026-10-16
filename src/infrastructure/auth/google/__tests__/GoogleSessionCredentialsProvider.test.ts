import { describe, it, expect, vi } from 'vitest';
import { GoogleSessionCredentialsProvider } from '../GoogleSessionCredentialsProvider';
import type { GoogleAuthPort, GoogleAuthSession } from '../../../../domain/auth/models/auth.types';

describe('GoogleSessionCredentialsProvider', () => {
  const mockSession: GoogleAuthSession = {
    user: {
      sub: 'google-sub-12345',
      email: 'user@example.com',
      name: 'Test User',
    },
    tokens: {
      accessToken: 'test-access-token',
      expiresAt: Date.now() + 3600000,
      sealedRefreshToken: 'test-sealed-refresh-token',
    },
  };

  it('returns credentials matching the active session and deviceId', async () => {
    const mockAuthService: GoogleAuthPort = {
      getSession: vi.fn().mockReturnValue(mockSession),
      getStatus: vi.fn().mockReturnValue('authenticated'),
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn(),
      subscribe: vi.fn(),
    };

    const provider = new GoogleSessionCredentialsProvider(mockAuthService, 'device-mac-456');
    const credentials = await provider.getCredentials();

    expect(credentials).toEqual({
      userId: 'google-sub-12345',
      deviceId: 'device-mac-456',
    });
    expect(mockAuthService.getSession).toHaveBeenCalled();
  });

  it('returns null when there is no active session', async () => {
    const mockAuthService: GoogleAuthPort = {
      getSession: vi.fn().mockReturnValue(null),
      getStatus: vi.fn().mockReturnValue('unauthenticated'),
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn(),
      subscribe: vi.fn(),
    };

    const provider = new GoogleSessionCredentialsProvider(mockAuthService, 'device-mac-456');
    const credentials = await provider.getCredentials();

    expect(credentials).toBeNull();
  });

  it('safely handles setCredentials and clearCredentials as no-ops', async () => {
    const mockAuthService: GoogleAuthPort = {
      getSession: vi.fn().mockReturnValue(null),
      getStatus: vi.fn().mockReturnValue('unauthenticated'),
      login: vi.fn(),
      logout: vi.fn(),
      getValidAccessToken: vi.fn(),
      subscribe: vi.fn(),
    };

    const provider = new GoogleSessionCredentialsProvider(mockAuthService, 'device-mac-456');
    await expect(provider.setCredentials({ userId: 'u1', deviceId: 'd1' })).resolves.toBeUndefined();
    await expect(provider.clearCredentials()).resolves.toBeUndefined();
  });
});
