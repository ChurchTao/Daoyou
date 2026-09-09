import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCTION_SECT_PRESENTATIONS } from './productionRuntime';

const forbiddenPlayerTerms =
  /[0-9%]|倍率|冷却|配置|构筑|技能槽|数值|开发|接口|数据库/;

describe('production sect onboarding presentations', () => {
  it('provides immersive scripts and local key art without player-facing system terms', () => {
    for (const presentation of Object.values(PRODUCTION_SECT_PRESENTATIONS)) {
      const onboarding = presentation.onboarding;
      expect(onboarding).toBeDefined();
      expect(onboarding?.traits).toHaveLength(3);
      expect(onboarding?.script.acts).toHaveLength(5);
      expect(onboarding?.script.backdrop.alt.trim()).not.toBe('');

      const playerCopy = [
        onboarding?.summary,
        ...(onboarding?.traits ?? []),
        ...(onboarding?.script.acts.flatMap((act) => [
          act.title,
          act.scene,
          act.body,
          act.speaker ?? '',
        ]) ?? []),
      ].join('\n');
      expect(playerCopy).not.toMatch(forbiddenPlayerTerms);

      const assetPath = onboarding?.script.backdrop.src.replace(/^\//, '');
      expect(assetPath).toBeTruthy();
      expect(existsSync(join(process.cwd(), 'public', assetPath!))).toBe(true);
    }
  });

  it('exposes only the gate and formation to foreign visitors', () => {
    for (const presentation of Object.values(PRODUCTION_SECT_PRESENTATIONS)) {
      const visitorHotspots = presentation.map.hotspots
        .filter((hotspot) => hotspot.visitor)
        .map((hotspot) => hotspot.id)
        .sort();

      expect(visitorHotspots).toEqual(['formation', 'gate']);
      expect(
        presentation.map.hotspots
          .filter((hotspot) => hotspot.visitor)
          .every((hotspot) => hotspot.visitor!.description.trim().length > 0),
      ).toBe(true);
    }
  });
});
