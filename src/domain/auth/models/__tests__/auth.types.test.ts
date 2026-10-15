import { describe, it, expect } from 'vitest';
import type {
  GoogleUserProfile,
  GoogleAuthTokens,
  GoogleAuthSession,
  AuthStatus,
  GoogleAuthPort,
} from '../auth.types';

describe('Domain: auth.types contracts', () => {
  it('shapes a valid GoogleAuthSession conforming to domain contract', () => {
    const user: GoogleUserProfile = {
      sub: 'google-sub-12345',
      email: 'learner@lunaclair.dev',
      name: 'Luna Learner',
      picture: 'https://example.com/avatar.png',
    };

    const tokens: GoogleAuthTokens = {
      accessToken: 'mock_access_token',
      expiresAt: 1700000000000,
      sealedRefreshToken: 'v1.aes256gcm.sealed_token_blob',
    };

    const session: GoogleAuthSession = {
      user,
      tokens,
    };

    expect(session.user.sub).toBe('google-sub-12345');
    expect(session.user.email).toBe('learner@lunaclair.dev');
    expect(session.tokens.sealedRefreshToken).toContain('sealed_token_blob');
    expect(session.tokens.expiresAt).toBeGreaterThan(0);
  });

  it('permits all valid AuthStatus variants', () => {
    const statuses: AuthStatus[] = [
      'unauthenticated',
      'authenticated',
      'authenticating',
      'standby',
    ];

    expect(statuses).toHaveLength(4);
    expect(statuses).toContain('unauthenticated');
    expect(statuses).toContain('authenticated');
  });

  it('satisfies GoogleAuthPort structural interface contract', () => {
    const dummyPort: GoogleAuthPort = {
      login: async () => ({
        user: { sub: 's', email: 'e', name: 'n' },
        tokens: { accessToken: 'a', expiresAt: 1, sealedRefreshToken: 'r' },
      }),
      logout: async () => {},
      getValidAccessToken: async () => 'mock-token',
      getSession: () => null,
      getStatus: () => 'unauthenticated',
      subscribe: () => () => {},
    };

    expect(typeof dummyPort.login).toBe('function');
    expect(typeof dummyPort.logout).toBe('function');
    expect(typeof dummyPort.getValidAccessToken).toBe('function');
    expect(typeof dummyPort.getSession).toBe('function');
    expect(typeof dummyPort.getStatus).toBe('function');
    expect(typeof dummyPort.subscribe).toBe('function');
  });
});
