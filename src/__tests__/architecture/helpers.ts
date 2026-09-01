import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

export interface ProhibitedPattern {
  /** Regex or string to match against import source paths */
  pattern: RegExp;
  /** Human-readable description for error messages */
  label: string;
}

export interface ImportViolation {
  file: string;
  line: number;
  importSource: string;
  rule: string;
}

/** Recursively collect .ts/.tsx source files, excluding tests. */
export function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        if (/\.(test|spec)\./i.test(entry.name)) continue;
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

/** Extract import sources from a TypeScript file's content. Returns {line, source} pairs. */
export function extractImports(content: string): Array<{ line: number; source: string }> {
  const imports: Array<{ line: number; source: string }> = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // Match: import ... from 'source' / import 'source' / } from 'source'
    // Also matches dynamic imports like import('source') but regex handles static imports mostly.
    const match = lines[i].match(/(?:from|import)\s+['"]([^'"]+)['"]/);
    if (match) {
      imports.push({ line: i + 1, source: match[1] });
    }
  }
  return imports;
}

/** Scan files in sourceDir and return all imports that match prohibited patterns. */
export function findViolations(
  sourceDir: string,
  prohibited: ProhibitedPattern[],
): ImportViolation[] {
  const files = collectSourceFiles(sourceDir);
  const violations: ImportViolation[] = [];
  
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    const imports = extractImports(content);
    for (const imp of imports) {
      for (const rule of prohibited) {
        if (rule.pattern.test(imp.source)) {
          violations.push({
            file: relative(resolve(sourceDir, '..', '..'), file),
            line: imp.line,
            importSource: imp.source,
            rule: rule.label,
          });
        }
      }
    }
  }
  
  return violations;
}
