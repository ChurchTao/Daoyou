import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { resolveGameShellKind } from './gameShellRegistry';

function hasRipgrepMatches(pattern: string, target: string) {
  try {
    execSync(`rg -n --glob '!**/*.test.ts' "${pattern}" ${target}`, {
      cwd: process.cwd(),
      stdio: 'pipe',
    });
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      error.status === 1
    ) {
      return false;
    }
    throw error;
  }
}

describe('game shell registry', () => {
  it('resolves shell ownership for migrated game routes', () => {
    expect(resolveGameShellKind('/game/create')).toBe('genesis');
    expect(resolveGameShellKind('/game/reincarnate')).toBe('genesis');
    expect(resolveGameShellKind('/game')).toBe('viewport');
    expect(resolveGameShellKind('/game/inventory')).toBe('viewport');
    expect(resolveGameShellKind('/game/body-cultivation')).toBe('viewport');
    expect(resolveGameShellKind('/game/bet-battle')).toBe('viewport');
    expect(resolveGameShellKind('/game/settings')).toBe('viewport');
    expect(resolveGameShellKind('/game/battle')).toBe('combat');
    expect(resolveGameShellKind('/game/battle/challenge')).toBe('combat');
    expect(resolveGameShellKind('/game/battle/battle-1')).toBe('combat');
    expect(resolveGameShellKind('/game/bet-battle/challenge')).toBe('combat');
    expect(resolveGameShellKind('/game/map')).toBe('map');
    expect(resolveGameShellKind('/game/dungeon')).toBe('dungeon');
    expect(resolveGameShellKind('/game/dungeon/history')).toBe('viewport');
  });

  it('keeps game routes free of InkPageShell references', () => {
    expect(hasRipgrepMatches('InkPageShell', 'src/react-app/routes/game')).toBe(
      false,
    );
  });

  it('removes deprecated game navigation and immersive bridge leftovers', () => {
    expect(
      hasRipgrepMatches(
        'quickActionGroups|QuickActionsGrid|useHomeViewModel|resolveDungeonImmersiveSceneDescriptor',
        'src/react-app',
      ),
    ).toBe(false);
  });
});
