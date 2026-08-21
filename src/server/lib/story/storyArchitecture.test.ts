import { describe, expect, test } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOTS = [
  'src/react-app/routes/game/auction',
  'src/react-app/routes/game/black-market',
  'src/react-app/routes/game/dungeon',
  'src/react-app/routes/game/sect',
  'src/react-app/routes/game/inn',
  'src/react-app/routes/game/market',
  'src/react-app/components/feature/retreat',
];

async function filesUnder(root: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
    }
  };
  await walk(root);
  return out;
}

describe('main-story architecture boundary', () => {
  test('gameplay domains do not know Volume I nodes or runtime events', async () => {
    const violations: string[] = [];
    for (const root of ROOTS) {
      for (const path of await filesUnder(root)) {
        const text = await readFile(path, 'utf8');
        if (
          /currentNodeId\s*===\s*['"]01-/.test(text) ||
          /currentStep\s*===/.test(text) ||
          /notifyStoryRuntimeEvent/.test(text) ||
          /volume1Definition/.test(text) ||
          /eventType:\s*['"]v1_/.test(text)
        ) {
          violations.push(path);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('continuation cards are not globally broadcast', async () => {
    const storyClient = await readFile(
      'src/react-app/lib/story/storyClient.ts',
      'utf8',
    );
    const host = await readFile(
      'src/react-app/components/feature/story/StoryEventHost.tsx',
      'utf8',
    );
    expect(storyClient).not.toContain('STORY_CONTINUATION_EVENT');
    expect(host).not.toContain('主线卷宗 · 线索更新');
    expect(host).not.toContain('navigate(action.href)');
  });

  test('Volume I prologue requires NPC interaction instead of page-mount auto advance', async () => {
    const surfaces = await readFile(
      'src/server/lib/story/surfaces/volume1Surfaces.ts',
      'utf8',
    );
    expect(surfaces).not.toContain("id: 'v1-prologue-affairs',");
    expect(surfaces).not.toContain("id: 'v1-prologue-herb',");
    expect(surfaces).not.toContain("id: 'v1-prologue-gate',");
    expect(surfaces).toContain("kind: 'npc-dialogue'");
  });

});
