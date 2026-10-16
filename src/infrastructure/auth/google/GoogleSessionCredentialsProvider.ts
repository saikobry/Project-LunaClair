import type { SessionCredentials } from '../../../domain/sync/models/sync.types';
import type { SessionCredentialsProvider } from '../../../domain/sync/services/SessionCredentialsProvider';
import type { GoogleAuthPort } from '../../../domain/auth/models/auth.types';

/**
 * GoogleAuth-backed implementation of SessionCredentialsProvider.
 * Bridges active Google OAuth identity into synchronization session credentials.
 */
export class GoogleSessionCredentialsProvider implements SessionCredentialsProvider {
  private readonly authService: GoogleAuthPort;
  private readonly deviceId: string;

  constructor(authService: GoogleAuthPort, deviceId: string) {
    this.authService = authService;
    this.deviceId = deviceId;
  }

  async getCredentials(): Promise<SessionCredentials | null> {
    const session = this.authService.getSession();
    if (!session) {
      return null;
    }

    return {
      userId: session.user.sub,
      deviceId: this.deviceId,
    };
  }

  async setCredentials(_credentials: SessionCredentials): Promise<void> {
    // Identity is managed strictly by GoogleAuthPort / Google OAuth sessions.
  }

  async clearCredentials(): Promise<void> {
    // Identity is managed strictly by GoogleAuthPort / Google OAuth sessions.
  }
}
