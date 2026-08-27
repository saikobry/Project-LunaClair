import type { SessionCredentials } from './sync.types';

/**
 * Domain port for retrieving, updating, and clearing active session identity credentials.
 */
export interface SessionCredentialsProvider {
  getCredentials(): Promise<SessionCredentials | null>;
  setCredentials(credentials: SessionCredentials): Promise<void>;
  clearCredentials(): Promise<void>;
}
