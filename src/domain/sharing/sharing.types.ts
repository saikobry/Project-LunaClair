/**
 * Domain types and transport contracts for Cloud Sharing (Phase 11C).
 */
import type { StudyPackage } from '../package/package.types';

export type ShareAccessType = 'public' | 'unlisted' | 'passcode';

export interface PublishShareOptions {
  accessType?: ShareAccessType;
  passcode?: string;
  expiresAt?: string;
  authToken?: string;
  userId?: string;
}

export interface PublishShareResult {
  id: string;
  format: 'lcpack';
  schemaVersion: number;
  title: string;
  description?: string;
  author?: string;
  accessType: ShareAccessType;
  shareUrl: string;
  createdAt: string;
}

export interface PublishedShare {
  id: string;
  format: 'lcpack';
  schemaVersion: number;
  title: string;
  description?: string;
  author?: string;
  accessType: ShareAccessType;
  package: StudyPackage;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  viewCount: number;
  downloadCount: number;
}

export interface ShareTransport {
  publish(pkg: StudyPackage, options?: PublishShareOptions, signal?: AbortSignal): Promise<PublishShareResult>;
  fetch(shareId: string, passcode?: string, signal?: AbortSignal): Promise<PublishedShare>;
  trackDownload(shareId: string, signal?: AbortSignal): Promise<{ success: boolean; downloadCount: number }>;
  delete(shareId: string, authToken?: string, signal?: AbortSignal): Promise<void>;
}
