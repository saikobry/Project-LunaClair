import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHARED_DIR = resolve(__dirname, '../../shared');

describe('Architecture: Shared Layer Purity', () => {
  it('must not import from domain, application, features, infrastructure, or app', () => {
    const violations = findViolations(SHARED_DIR, [
      { pattern: /\/domain\/|\.\.\/(\.\.\/)*(domain)/, label: 'shared → domain' },
      { pattern: /\/application\/|\.\.\/(\.\.\/)*(application)/, label: 'shared → application' },
      { pattern: /\/features\/|\.\.\/(\.\.\/)*(features)/, label: 'shared → features' },
      { pattern: /\/infrastructure\/|\.\.\/(\.\.\/)*(infrastructure)/, label: 'shared → infrastructure' },
      { pattern: /\/app\/|\.\.\/(\.\.\/)*(app)/, label: 'shared → app' },
    ]);
    
    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Shared layer has ${violations.length} prohibited import(s):\n${report}`);
    }
  });
});
