import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('sect gate sweep route lifecycle', () => {
  it('mounts Phaser directly and cleans up the owned immersive state', () => {
    const route = readFileSync(
      'src/react-app/routes/game/sect/gate/sweep/route.tsx',
      'utf8',
    );
    const runtime = readFileSync(
      'src/react-app/routes/game/sect/gate/sweep/SweepPhaserRuntime.ts',
      'utf8',
    );

    expect(route).toContain('attachSweepPhaser({');
    expect(route).toContain('controller.destroy()');
    expect(route).toContain('releaseSweepImmersiveMode()');
    expect(route).toContain('portraitBlocked');
    expect(route).not.toContain('<iframe');
    expect(runtime).toContain('game.destroy(true)');
    expect(runtime).toContain("tile.on('pointerdown'");
    expect(runtime).toContain("tile.on('pointerover'");
  });
});
