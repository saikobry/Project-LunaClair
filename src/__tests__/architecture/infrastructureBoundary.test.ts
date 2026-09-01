import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INFRA_DIR = resolve(__dirname, '../../infrastructure');

describe('Architecture: Infrastructure Layer Boundary', () => {
  it('must not import from features', () => {
    const violations = findViolations(INFRA_DIR, [
      { pattern: /\/features\/|\.\.\/(\.\.\/)*(features)/, label: 'infrastructure → features' },
    ]);
    
    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Infrastructure layer has ${violations.length} prohibited import(s):\n${report}`);
    }
  });

  it('application imports are limited to QuizDraft contracts', () => {
    const violations = findViolations(INFRA_DIR, [
      { pattern: /\/application\/|\.\.\/(\.\.\/)*(application)/, label: 'infrastructure → application' },
    ]);
    
    // Filter out allowed QuizDraft exceptions
    const actual = violations.filter(v => !v.importSource.includes('quiz-management/drafts'));
    
    if (actual.length > 0) {
      const report = actual.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Infrastructure layer has ${actual.length} unauthorized application import(s) (only QuizDraft* allowed):\n${report}`);
    }
  });
});
