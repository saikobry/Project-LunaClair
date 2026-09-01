import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const APP_LAYER_DIR = resolve(__dirname, '../../application');

describe('Architecture: Application Layer Boundary', () => {
  it('must not import from features, infrastructure, app, React, TanStack, or Dexie', () => {
    const violations = findViolations(APP_LAYER_DIR, [
      { pattern: /\/features\/|\.\.\/(\.\.\/)*(features)/, label: 'application → features' },
      { pattern: /\/infrastructure\/|\.\.\/(\.\.\/)*(infrastructure)/, label: 'application → infrastructure' },
      { pattern: /\/app\/|\.\.\/(\.\.\/)*(app)/, label: 'application → app' },
      { pattern: /^react$|^react\/|^react-dom/, label: 'application → React' },
      { pattern: /^@tanstack/, label: 'application → TanStack' },
      { pattern: /^dexie/, label: 'application → Dexie' },
    ]);
    
    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Application layer has ${violations.length} prohibited import(s):\n${report}`);
    }
  });
});
