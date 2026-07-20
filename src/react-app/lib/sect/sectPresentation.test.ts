import { describe, expect, it } from 'vitest';
import { SectPresentationRegistry } from './presentation/core/registry';

describe('sect presentation registry', () => {
  it('returns generic facility navigation for a known sect without a custom map', () => {
    const registry = new SectPresentationRegistry(['fixture-sect']);
    const presentation = registry.presentation('fixture-sect');
    expect(presentation.mapImage).toBeUndefined();
    expect(presentation.hotspots.some((spot) => spot.route === '/game/sect/hall')).toBe(true);
  });

  it('rejects unknown custom presentation plugins', () => {
    const registry = new SectPresentationRegistry(['fixture-sect']);
    expect(() =>
      registry.register({
        sectId: 'missing-sect',
        presentation: {
          sectId: 'missing-sect',
          facilityLabels: {},
          lockedFacilities: [],
          hotspots: [],
        },
      }),
    ).toThrow('没有对应内容模块');
  });

  it('rejects duplicate custom presentation contributions', () => {
    const registry = new SectPresentationRegistry(['fixture-sect']);
    const manifest = {
      sectId: 'fixture-sect',
      presentation: {
        sectId: 'fixture-sect',
        facilityLabels: {},
        lockedFacilities: [],
        hotspots: [],
      },
    } as const;

    registry.register(manifest);
    expect(() => registry.register(manifest)).toThrow('重复注册');
  });
});
