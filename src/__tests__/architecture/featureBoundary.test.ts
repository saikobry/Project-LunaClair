import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FEATURES_DIR = resolve(__dirname, '../../features');

describe('Architecture: Feature Layer Boundary', () => {
  it('must not import from infrastructure', () => {
    const violations = findViolations(FEATURES_DIR, [
      { pattern: /\/infrastructure\/|\.\.\/(\.\.\/)*(infrastructure)/, label: 'features → infrastructure' },
    ]);
    
    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Feature layer has ${violations.length} prohibited import(s):\n${report}`);
    }
  });
});
