import type { EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { describe, expect, it } from 'vitest';
import { TIANYAN_MODULE } from '..';
import type { TianyanElement } from '../shared/reactions';
import { tianyanState } from './testState';

function rawBuild() {
  const sect = tianyanState();
  return TIANYAN_MODULE.createBaseBuilder({
    sect,
    realm: '化神',
    methodGrowth: TIANYAN_MODULE.methodGrowth,
  }).build();
}

function layerEffects(abilityId: string, oldSeal: TianyanElement): EffectConfig[] {
  const layer = rawBuild().abilities[abilityId].config.effectLayers?.find(
    (entry) => entry.id === `old-${oldSeal}`,
  );
  expect(layer).toBeDefined();
  return layer?.effects ?? [];
}

function directCoefficient(effects: EffectConfig[]): number {
  const damage = effects.find((effect) =>
    effect.type === 'damage' && effect.params.damageSource === 'direct');
  expect(damage?.type).toBe('damage');
  if (damage?.type !== 'damage') return 0;
  return damage.params.value.coefficient ?? 0;
}

function noSealCoefficient(abilityId: string): number {
  const effects = rawBuild().abilities[abilityId].config.effectLayers?.find(
    (entry) => entry.id === 'no-seal',
  )?.effects ?? [];
  return directCoefficient(effects);
}

describe('天衍十种反应配置矩阵', () => {
  it.each([
    ['flowing-flame', 'wood', 1.5, 'wildfire'],
    ['earth-bearing-seal', 'fire', 1.4, 'lava'],
    ['metal-cloud-cutter', 'earth', 1.4, 'forge-edge'],
    ['dark-water-return', 'metal', 1.4, 'cold-spring'],
    ['verdant-pulse', 'water', 1.4, 'flourish'],
  ] as const)(
    '%s/%s印化生只有一段按比例强化的直接主伤害，并具名触发%s',
    (abilityId, oldSeal, multiplier, reactionId) => {
      const effects = layerEffects(abilityId, oldSeal);
      expect(directCoefficient(effects)).toBeCloseTo(
        noSealCoefficient(abilityId) * multiplier,
        8,
      );
      expect(effects.filter((effect) => effect.type === 'damage')).toHaveLength(2);
      expect(effects).toContainEqual(
        expect.objectContaining({
          type: 'mechanic_log',
          params: expect.objectContaining({
            internalKey: `sect.tianyan.reaction.${reactionId}`,
          }),
        }),
      );
    },
  );

  it('锻锋把40%穿防并入唯一主伤害配置', () => {
    const direct = layerEffects('metal-cloud-cutter', 'earth').find(
      (effect) => effect.type === 'damage',
    );
    expect(direct).toMatchObject({
      type: 'damage',
      params: { bypassDefenseRatio: 0.4 },
    });
  });

  it('燎原只手动结算当前目标的新灼烧一次，不包含扩散效果', () => {
    const effects = layerEffects('flowing-flame', 'wood');
    expect(effects).toContainEqual(
      expect.objectContaining({
        type: 'buff_periodic_settlement',
        params: expect.objectContaining({ mode: 'once_keep_duration' }),
      }),
    );
    expect(effects.some((effect) => effect.type === 'status_spread')).toBe(false);
  });

  it.each([
    ['dark-water-return', 'fire', 0.8, 'vaporize', undefined],
    ['earth-bearing-seal', 'water', 0.4, 'quagmire', 'earth'],
    ['verdant-pulse', 'earth', 0.5, 'root-collapse', 'wood'],
    ['metal-cloud-cutter', 'wood', 0.4, 'sever-meridian', 'metal'],
    ['flowing-flame', 'metal', 0.5, 'melt-metal', 'fire'],
  ] as const)(
    '%s/%s印冲克以主伤害记忆的%s倍产生%s追伤',
    (abilityId, oldSeal, ratio, reactionId, element) => {
      const releases = layerEffects(abilityId, oldSeal).filter(
        (effect) => effect.type === 'damage_memory' && effect.params.mode === 'release',
      );
      const reactionRelease = releases.find((effect) =>
        effect.type === 'damage_memory' &&
        effect.params.cause?.id === `sect.tianyan.reaction.${reactionId}`,
      );
      expect(reactionRelease).toMatchObject({
        type: 'damage_memory',
        params: {
          ratio,
          releaseAs: 'resolved_follow_up',
          consume: false,
          cause: { displayName: expect.stringContaining('冲克·') },
        },
      });
      if (reactionRelease?.type === 'damage_memory') {
        if (element) expect(reactionRelease.params.damageTags).toHaveLength(1);
        else expect(reactionRelease.params.damageTags).toBeUndefined();
      }
    },
  );

  it('泥沼和断脉分别使用定身、禁法并配置控制抵抗替代效果', () => {
    const quagmire = layerEffects('earth-bearing-seal', 'water').find(
      (effect) => effect.type === 'apply_buff' &&
        effect.params.buffConfig.type === 'control',
    );
    expect(quagmire).toMatchObject({
      type: 'apply_buff',
      params: {
        buffConfig: { statusTags: ['Status.Control.NoAction'] },
        onResistEffects: [expect.objectContaining({ type: 'apply_buff' })],
      },
    });
    const sever = layerEffects('metal-cloud-cutter', 'wood').find(
      (effect) => effect.type === 'apply_buff' &&
        effect.params.buffConfig.type === 'control',
    );
    expect(sever).toMatchObject({
      type: 'apply_buff',
      params: {
        buffConfig: { statusTags: ['Status.Control.NoSkill'] },
        onResistEffects: [expect.objectContaining({ type: 'apply_buff' })],
      },
    });
  });

  it('蒸发只结算并移除同施术者来源的灼烧，不匹配熔岩', () => {
    const settle = layerEffects('dark-water-return', 'fire').find(
      (effect) => effect.type === 'buff_periodic_settlement',
    );
    expect(settle).toMatchObject({
      type: 'buff_periodic_settlement',
      params: {
        match: { id: 'sect.tianyan.burn' },
        mode: 'remaining_remove',
        source: 'caster',
      },
    });
  });
});
