import { describe, expect, it } from 'vitest';
import { resolveSectMethodCurve, type SectDefinition } from '../core';
import { LINGXIAO_SECT } from './lingxiao';
import { TIANYAN_SECT } from './tianyan';
import { WUXIANG_SECT } from './wuxiang';
import { YOUDU_SECT } from './youdu';
import { JIUJIE_MODULE } from './jiujie';

const JIUJIE_SECT = JIUJIE_MODULE.definition;

type BudgetBuild = {
  id: string;
  contributionAt(level: number): number;
};

function method(definition: SectDefinition, methodId: string) {
  return definition.methods.find((entry) => entry.id === methodId)!;
}

function progress(definition: SectDefinition, methodId: string, level: number) {
  return resolveSectMethodCurve(
    method(definition, methodId).growthProfile.curve,
    level,
  );
}

function panel(definition: SectDefinition, methodId: string, level: number) {
  const entry = method(definition, methodId);
  return (
    (entry.growthProfile.panelModifier?.maxValue ?? 0) *
    progress(definition, methodId, level)
  );
}

function effect(
  definition: SectDefinition,
  methodId: string,
  category: 'damage' | 'heal' | 'shield' | 'status',
  level: number,
) {
  const entry = method(definition, methodId);
  return entry.growthProfile.effects[category] * progress(definition, methodId, level);
}

const outputContribution = (multiplier: number) => 1 - 1 / multiplier;

const builds: Record<string, BudgetBuild[]> = {
  jiujie: [
    { id: 'calamity-eye-offense', penetrationUtilization: 0.55, statusUtilization: 0.20 },
    { id: 'condemnation-control', penetrationUtilization: 0.35, statusUtilization: 0.35 },
  ].map(({ id, penetrationUtilization, statusUtilization }) => ({
    id,
    contributionAt: (level) =>
      outputContribution(
        ((1 + panel(JIUJIE_SECT, 'heavenly-record', level)) *
          (1 + effect(JIUJIE_SECT, 'heavenly-record', 'damage', level)) *
          (1 + effect(JIUJIE_SECT, 'jiujie-canon', 'status', level) * statusUtilization)) /
          (1 - penetrationUtilization * panel(JIUJIE_SECT, 'thunder-prison', level)),
      ),
  })),
  lingxiao: ['aggressive', 'heavy-break'].map((id) => ({
    id,
    contributionAt: (level) =>
      outputContribution(
        (1 + panel(LINGXIAO_SECT, 'sword-guidance', level)) *
          (1 + effect(LINGXIAO_SECT, 'sword-guidance', 'damage', level)),
      ),
  })),
  tianyan: [
    { id: 'hetu-pure-reaction', penetrationUtilization: 0.45 },
    { id: 'luoshu-low-hp-burst', penetrationUtilization: 0.55 },
  ].map(({ id, penetrationUtilization }) => ({
    id,
    contributionAt: (level) =>
      outputContribution(
        ((1 + panel(TIANYAN_SECT, 'fire-illumination', level)) *
          (1 + effect(TIANYAN_SECT, 'fire-illumination', 'damage', level))) /
          (1 -
            penetrationUtilization *
              panel(TIANYAN_SECT, 'metal-severing', level)),
      ),
  })),
  youdu: [
    { id: 'tide-cycle', statusUtilization: 0.4 },
    { id: 'pin-the-caster', statusUtilization: 0.48 },
  ].map(({ id, statusUtilization }) => ({
    id,
    contributionAt: (level) => {
      const blendedStatusProgress =
        (progress(YOUDU_SECT, 'youdu-canon', level) +
          progress(YOUDU_SECT, 'dead-heart-living-spirit', level)) /
        2;
      const statusCap = method(YOUDU_SECT, 'youdu-canon').growthProfile.effects
        .status;
      return outputContribution(
        (1 + panel(YOUDU_SECT, 'three-souls-separation', level)) *
          (1 +
            effect(YOUDU_SECT, 'three-souls-separation', 'damage', level)) *
          (1 + statusCap * statusUtilization * blendedStatusProgress),
      );
    },
  })),
  wuxiang: [
    { id: 'guard', sustainUtilization: 0.3 },
    { id: 'trial-fire', sustainUtilization: 0.2 },
  ].map(({ id, sustainUtilization }) => ({
    id,
    contributionAt: (level) => {
      const mixedDefense =
        (panel(WUXIANG_SECT, 'white-bone', level) +
          panel(WUXIANG_SECT, 'reed-crossing-method', level)) /
        2;
      const sustain =
        effect(WUXIANG_SECT, 'blood-lotus', 'heal', level) *
        sustainUtilization;
      return outputContribution(
        (1 + panel(WUXIANG_SECT, 'blood-lotus', level)) *
          (1 + mixedDefense) *
          (1 + sustain),
      );
    },
  })),
};

const milestoneBands = [
  [45, 0.05, 0.1],
  [90, 0.12, 0.19],
  [135, 0.2, 0.27],
] as const;

describe('五宗心法统一贡献率门禁', () => {
  it.each(Object.entries(builds))('%s代表构筑满足阶段成长预算', (_sectId, entries) => {
    for (const [level, minimum, maximum] of milestoneBands) {
      for (const entry of entries) {
        expect(entry.contributionAt(level), `${entry.id}@${level}`).toBeGreaterThanOrEqual(
          minimum,
        );
        expect(entry.contributionAt(level), `${entry.id}@${level}`).toBeLessThanOrEqual(
          maximum,
        );
      }
    }
  });

  it.each(Object.entries(builds))('%s满级中位贡献为28%至32%', (_sectId, entries) => {
    const values = entries.map((entry) => entry.contributionAt(180)).sort();
    const median = (values[0] + values[1]) / 2;
    expect(median).toBeGreaterThanOrEqual(0.28);
    expect(median).toBeLessThanOrEqual(0.32);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0.25);
      expect(value).toBeLessThanOrEqual(0.35);
    }
  });
});
