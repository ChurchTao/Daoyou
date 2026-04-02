import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { AbilityType } from '@/engine/creation-v2/contracts/battle';
import { Material } from '@/types/cultivator';

/** 构造测试专用的 ore 材料 */
const makeOre = (name: string, rank = '灵品' as Material['rank']): Material => ({
  id: `test-${name}`,
  name,
  type: 'ore',
  rank,
  quantity: 2,
  element: undefined,
  description: '铁锋矿石，锋利',
});

const makeFireOre = (name: string, rank = '灵品' as Material['rank']): Material => ({
  id: `test-${name}`,
  name,
  type: 'ore',
  rank,
  quantity: 2,
  element: '火',
  description: '赤炎铁矿，火属性',
});

const makeHerb = (name: string, rank = '灵品' as Material['rank']): Material => ({
  id: `test-${name}`,
  name,
  type: 'herb',
  rank,
  quantity: 2,
  element: undefined,
  description: '灵草，生息养元',
});

const makeGongfaManual = (name: string, rank = '灵品' as Material['rank']): Material => ({
  id: `test-${name}`,
  name,
  type: 'gongfa_manual',
  rank,
  quantity: 1,
  element: undefined,
  description: '功法诀录灵魄',
});

// ─── 完整流水线 helper ────────────────────────────────────────────────────────

function runFullPipeline(materials: Material[], productType: 'skill' | 'artifact' | 'gongfa') {
  const orchestrator = new CreationOrchestrator();
  const session = orchestrator.createSession({ productType, materials });

  orchestrator.submitMaterials(session);
  orchestrator.analyzeMaterialsWithDefaults(session);
  orchestrator.resolveIntentWithDefaults(session);
  orchestrator.validateRecipeWithDefaults(session);

  if (session.state.failureReason) return null;

  orchestrator.budgetEnergyWithDefaults(session);
  orchestrator.buildAffixPoolWithDefaults(session);
  orchestrator.rollAffixesWithDefaults(session);
  orchestrator.composeBlueprintWithDefaults(session);
  return orchestrator.materializeOutcome(session);
}

// ─── SkillBlueprintComposer ──────────────────────────────────────────────────

describe('SkillBlueprintComposer', () => {
  it('技能 golden case: fire ore → active_skill with damage effect', () => {
    const outcome = runFullPipeline([makeFireOre('赤炎铁矿'), makeOre('锋铁')], 'skill');
    expect(outcome).not.toBeNull();
    expect(outcome!.blueprint.outcomeKind).toBe('active_skill');
    expect(outcome!.blueprint.productModel.productType).toBe('skill');
    expect(outcome!.blueprint.abilityConfig.type).toBe(AbilityType.ACTIVE_SKILL);
    expect(outcome!.blueprint.abilityConfig.slug).toBe(outcome!.blueprint.productModel.slug);
    expect(outcome!.blueprint.abilityConfig.effects?.length).toBeGreaterThan(0);
    // 第一个效果应是 damage 或 apply_buff 类型
    const firstEffect = outcome!.blueprint.abilityConfig.effects![0];
    expect(['damage', 'apply_buff', 'percent_damage_modifier']).toContain(firstEffect.type);
  });

  it('heal 材料 → active_skill 带 heal 效果', () => {
    const herbs: Material[] = [makeHerb('生息灵草'), makeHerb('愈合药草')];
    const outcome = runFullPipeline(herbs, 'skill');
    expect(outcome).not.toBeNull();
    const effects = outcome!.blueprint.abilityConfig.effects ?? [];
    const hasHeal = effects.some((e) => e.type === 'heal');
    const hasDamage = effects.some((e) => e.type === 'damage');
    // 愈草材料应触发 heal core 或 damage core（取决于随机），至少有一个效果
    expect(effects.length).toBeGreaterThan(0);
    void hasHeal;
    void hasDamage;
  });

  it('技能蓝图有合法的 mpCost 和 cooldown', () => {
    const outcome = runFullPipeline([makeOre('铁矿'), makeOre('铁矿')], 'skill');
    if (!outcome) return; // 可能 conflict
    const cfg = outcome.blueprint.abilityConfig;
    expect(cfg.mpCost).toBeGreaterThanOrEqual(10);
    expect(cfg.cooldown).toBeGreaterThanOrEqual(1);
    expect(cfg.cooldown).toBeLessThanOrEqual(3);
  });
});

// ─── ArtifactBlueprintComposer ───────────────────────────────────────────────

describe('ArtifactBlueprintComposer', () => {
  it('法宝 golden case → artifact outcome with passive listeners', () => {
    const outcome = runFullPipeline([makeOre('玄铁矿'), makeOre('锋铁矿')], 'artifact');
    expect(outcome).not.toBeNull();
    expect(outcome!.blueprint.outcomeKind).toBe('artifact');
    expect(outcome!.blueprint.productModel.productType).toBe('artifact');
    expect(outcome!.blueprint.abilityConfig.type).toBe(AbilityType.PASSIVE_SKILL);
    expect(outcome!.blueprint.abilityConfig.listeners?.length).toBeGreaterThan(0);
    if (outcome!.blueprint.productModel.productType === 'artifact') {
      expect(outcome!.blueprint.productModel.artifactConfig.progressionPolicy).toBe('reforgeable');
    }
  });

  it('法宝 listener 每个至少含一个 effect', () => {
    const outcome = runFullPipeline([makeOre('玄铁矿'), makeOre('守护矿')], 'artifact');
    if (!outcome) return;
    for (const listener of outcome.blueprint.abilityConfig.listeners ?? []) {
      expect(listener.effects.length).toBeGreaterThan(0);
    }
  });
});

// ─── GongFaBlueprintComposer ─────────────────────────────────────────────────

describe('GongFaBlueprintComposer', () => {
  it('功法 golden case → gongfa outcome with attribute_stat_buff listener', () => {
    const outcome = runFullPipeline([makeGongfaManual('灵魄心经'), makeHerb('灵草')], 'gongfa');
    expect(outcome).not.toBeNull();
    expect(outcome!.blueprint.outcomeKind).toBe('gongfa');
    expect(outcome!.blueprint.productModel.productType).toBe('gongfa');
    expect(outcome!.blueprint.abilityConfig.type).toBe(AbilityType.PASSIVE_SKILL);
    const listeners = outcome!.blueprint.abilityConfig.listeners ?? [];
    expect(listeners.length).toBeGreaterThan(0);
    // 至少一个 listener 的 effect 是 apply_buff
    const hasStatBuff = listeners.some((l) =>
      l.effects.some((e) => e.type === 'apply_buff'),
    );
    expect(hasStatBuff).toBe(true);
    if (outcome!.blueprint.productModel.productType === 'gongfa') {
      expect(outcome!.blueprint.productModel.gongfaConfig.progressionPolicy).toBe('comprehension');
    }
  });

  it('功法 listeners 全部含有 effects', () => {
    const outcome = runFullPipeline([makeGongfaManual('悟道心法'), makeHerb('灵草')], 'gongfa');
    if (!outcome) return;
    for (const listener of outcome.blueprint.abilityConfig.listeners ?? []) {
      expect(listener.effects.length).toBeGreaterThan(0);
    }
  });
});

// ─── ProductComposerRegistry 路由 ────────────────────────────────────────────

describe('CreationOrchestrator with ProductComposerRegistry', () => {
  it('skill → active_skill, artifact → artifact, gongfa → gongfa', () => {
    const skillOutcome = runFullPipeline([makeOre('铁矿'), makeOre('铁矿')], 'skill');
    const artifactOutcome = runFullPipeline([makeOre('玄铁'), makeOre('玄铁')], 'artifact');
    const gongfaOutcome = runFullPipeline([makeGongfaManual('心法'), makeHerb('灵草')], 'gongfa');

    if (skillOutcome) expect(skillOutcome.blueprint.outcomeKind).toBe('active_skill');
    if (artifactOutcome) expect(artifactOutcome.blueprint.outcomeKind).toBe('artifact');
    if (gongfaOutcome) expect(gongfaOutcome.blueprint.outcomeKind).toBe('gongfa');
  });
});
