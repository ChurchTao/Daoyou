import { resolveSectPresentation } from '@shared/engine/sect';
import { describe, expect, it } from 'vitest';
import { SectTaskRendererRegistry } from './presentation/core/registry';

describe('sect presentation', () => {
  it('returns generic facility navigation for a known sect without a custom map', () => {
    const presentation = resolveSectPresentation('fixture-sect');
    expect(presentation.map.image).toBeUndefined();
    expect(
      presentation.map.hotspots.some(
        (spot) => spot.route === '/game/sect/hall',
      ),
    ).toBe(true);
    expect(presentation.scenes.paths.title).toBe('悟道处');
  });

  it('merges pure data themes and rejects incomplete custom maps', () => {
    const presentation = resolveSectPresentation('fixture-sect', {
      sectId: 'fixture-sect',
      scenes: { arena: { title: '星轨演法台' } },
      terms: { abilityChanges: '术式变化' },
    });
    expect(presentation.scenes.arena.title).toBe('星轨演法台');
    expect(presentation.scenes.arena.loadingText).toBe('演武阵法正在开启……');
    expect(presentation.terms.abilityChanges).toBe('术式变化');
    expect(() =>
      resolveSectPresentation('fixture-sect', {
        sectId: 'fixture-sect',
        map: { image: '/fixture.webp', alt: '样例地图' },
      }),
    ).toThrow('完整热点配置');
  });

  it('rejects unknown custom task renderer plugins', () => {
    const registry = new SectTaskRendererRegistry(['fixture-sect']);
    expect(() =>
      registry.register({
        sectId: 'missing-sect',
        actions: [],
      }),
    ).toThrow('没有对应内容模块');
  });

  it('rejects duplicate task renderer contributions', () => {
    const registry = new SectTaskRendererRegistry(['fixture-sect']);
    const manifest = {
      sectId: 'fixture-sect',
      actions: [{ key: 'fixture.action', renderer: () => null }],
    } as const;

    registry.register(manifest);
    expect(() => registry.register(manifest)).toThrow('展示器重复注册');
  });
});
