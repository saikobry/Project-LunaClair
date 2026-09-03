import { describe, it, expect } from 'vitest';
import { resolve, dirname } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { findViolations, collectSourceFiles, extractImports } from './helpers';

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

  it('must not contain obsolete catalog feature directory', () => {
    const catalogDir = resolve(FEATURES_DIR, 'catalog');
    expect(existsSync(catalogDir), 'src/features/catalog must be dissolved into bounded contexts').toBe(false);
  });

  it('features must not import route screens from src/app/screens', () => {
    const violations = findViolations(FEATURES_DIR, [
      { pattern: /\/app\/screens\/|\.\.\/(\.\.\/)*(app\/screens)/, label: 'features → app/screens' },
    ]);

    if (violations.length > 0) {
      const report = violations.map(v => `  ${v.file}:${v.line} - import '${v.importSource}' (${v.rule})`).join('\n');
      expect.fail(`Features must not depend on application screens:\n${report}`);
    }
  });

  it('must strictly prevent circular dependencies between bounded feature contexts (ADR-014)', () => {
    const featureEntries = readdirSync(FEATURES_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const adjacency = new Map<string, Set<string>>();
    for (const f of featureEntries) {
      adjacency.set(f, new Set<string>());
    }

    // Build directed feature dependency graph
    for (const feature of featureEntries) {
      const featureRoot = resolve(FEATURES_DIR, feature);
      const files = collectSourceFiles(featureRoot);

      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        const imports = extractImports(content);

        for (const imp of imports) {
          for (const targetFeature of featureEntries) {
            if (targetFeature === feature) continue;

            // Check if import targets another feature
            const matchesDirect = imp.source.includes(`features/${targetFeature}/`) ||
              imp.source.startsWith(`../${targetFeature}/`) ||
              imp.source.startsWith(`../../${targetFeature}/`) ||
              imp.source.startsWith(`../../../${targetFeature}/`);

            if (matchesDirect) {
              adjacency.get(feature)?.add(targetFeature);
            }
          }
        }
      }
    }

    // Cycle detection via DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    function dfs(node: string, path: string[]) {
      visited.add(node);
      recStack.add(node);

      const neighbors = adjacency.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor]);
        } else if (recStack.has(neighbor)) {
          cycles.push([...path, neighbor]);
        }
      }

      recStack.delete(node);
    }

    for (const feature of featureEntries) {
      if (!visited.has(feature)) {
        dfs(feature, [feature]);
      }
    }

    if (cycles.length > 0) {
      const cycleReport = cycles.map((c) => c.join(' -> ')).join('\n');
      expect.fail(`Circular dependency detected between feature bounded contexts:\n${cycleReport}`);
    }
  });
});
