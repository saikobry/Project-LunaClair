import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DOMAIN_DIR = resolve(__dirname, '../../domain');

describe('Architecture: Domain Layer Purity', () => {
  it('must not import from application, features, infrastructure, app, React, or Dexie', () => {
    const violations = findViolations(DOMAIN_DIR, [
      { pattern: /\/application\/|\.\.\/(\.\.\/)*(application)/, label: 'domain → application' },
      { pattern: /\/features\/|\.\.\/(\.\.\/)*(features)/, label: 'domain → features' },
      { pattern: /\/infrastructure\/|\.\.\/(\.\.\/)*(infrastructure)/, label: 'domain → infrastructure' },
      { pattern: /\/app\/|\.\.\/(\.\.\/)*(app)/, label: 'domain → app' },
      { pattern: /^react$|^react\/|^react-dom/, label: 'domain → React' },
      { pattern: /^dexie/, label: 'domain → Dexie' },
      { pattern: /^@tanstack/, label: 'domain → TanStack' },
    ]);
    
    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Domain layer has ${violations.length} prohibited import(s):\n${report}`);
    }
  });
});
