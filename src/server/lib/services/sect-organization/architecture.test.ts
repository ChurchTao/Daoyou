import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

function imports(path: string): string[] {
  const source = readFileSync(path, 'utf8');
  return ts.preProcessFile(source, true, true).importedFiles.map((item) => item.fileName);
}

const sourceRoot = fileURLToPath(new URL('../../../../', import.meta.url));

function resolveSourceImport(from: string, specifier: string): string | undefined {
  const aliases: Record<string, string> = {
    '@app/': 'react-app/',
    '@server/': 'server/',
    '@shared/': 'shared/',
  };
  const alias = Object.entries(aliases).find(([prefix]) => specifier.startsWith(prefix));
  const base = alias
    ? resolve(sourceRoot, alias[1], specifier.slice(alias[0].length))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : undefined;
  if (!base) return undefined;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return undefined;
}

function dependencyEdges(files: readonly string[]) {
  return files.flatMap((file) =>
    imports(file).flatMap((specifier) => {
      const target = resolveSourceImport(file, specifier);
      return target ? [{ source: file, target }] : [];
    }),
  );
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')
      ? [path]
      : [];
  });
}

function dependencyClosure(
  entries: readonly string[],
  shouldTraverse: (path: string) => boolean,
) {
  const visited = new Set<string>();
  const edges: Array<{ source: string; target: string }> = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const source = queue.shift()!;
    if (visited.has(source)) continue;
    visited.add(source);
    for (const edge of dependencyEdges([source])) {
      edges.push(edge);
      if (shouldTraverse(edge.target)) queue.push(edge.target);
    }
  }
  return edges;
}

describe('sect organization architecture', () => {
  it('keeps the pure organization domain independent from server and React', () => {
    const files = sourceFiles(
      fileURLToPath(
        new URL('../../../../shared/engine/sect/core/organization/', import.meta.url),
      ),
    );
    expect(
      dependencyEdges(files).filter(
        ({ target }) => target.includes('/src/server/') || target.includes('/src/react-app/'),
      ),
    ).toEqual([]);
  });

  it('keeps every application service behind hand-written ports', () => {
    const directory = fileURLToPath(new URL('./', import.meta.url));
    const domainDirectory = fileURLToPath(
      new URL('../../../../shared/engine/sect/core/', import.meta.url),
    );
    const files = sourceFiles(directory).filter(
      (path) =>
        !path.includes('/testing/') &&
        !path.includes('/plugins/') &&
        !path.endsWith('/index.ts') &&
        !path.endsWith('/PostgresSectOrganizationAdapters.ts') &&
        !path.endsWith('/productionSectOrganization.ts'),
    );
    expect(
      dependencyClosure(
        files,
        (path) => path.startsWith(directory) || path.startsWith(domainDirectory),
      ).filter(
        ({ target }) =>
          target.includes('/server/lib/repositories/') ||
          target.includes('/server/lib/drizzle/') ||
          target.includes('/shared/engine/sect/content/lingxiao/') ||
          target.includes('/react-app/'),
      ),
    ).toEqual([]);
  });

  it('removes the legacy transaction workflow', () => {
    expect(
      existsSync(fileURLToPath(new URL('./SectTaskWorkflow.ts', import.meta.url))),
    ).toBe(false);
    expect(
      existsSync(fileURLToPath(new URL('./SectOrganizationSupport.ts', import.meta.url))),
    ).toBe(false);
  });
});
