import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  hasSectTaskActionRenderer,
  registerSectTaskActionRenderer,
} from './sectTaskActionRegistry';

describe('sect task presentation registry', () => {
  it('supports new renderers without changing the affairs page', () => {
    expect(hasSectTaskActionRenderer('sect.action.sweep-entry')).toBe(true);
    registerSectTaskActionRenderer('fixture.action.custom', () => null);
    expect(hasSectTaskActionRenderer('fixture.action.custom')).toBe(true);
    expect(hasSectTaskActionRenderer('fixture.action.missing')).toBe(false);
  });

  it('keeps the affairs page independent from concrete task ids', () => {
    const source = readFileSync(
      'src/react-app/routes/game/sect/affairs/route.tsx',
      'utf8',
    );
    for (const taskId of [
      'gate_sweep',
      'mine_patrol',
      'pill_delivery',
      'artifact_delivery',
      'weekly_tournament',
      'weekly_bounty',
      'elder_trial',
    ])
      expect(source).not.toContain(taskId);
  });
});
