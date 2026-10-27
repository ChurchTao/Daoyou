import type { CompiledTowerEncounter } from '@daoyou/game-domain/tower';
import {
  TOWER_ENCOUNTER_PACK as pack,
  TOWER_CATALOG,
  TOWER_SKILLS,
  TOWER_STATUS_DEFS,
  type TowerModifier,
} from '@daoyou/game-content/tower';
import type { RealmType } from '@daoyou/constants/realms';
import { UnitKind } from '@daoyou/combat-core/enums';
import { type CreateBattleInput, type SkillDef, type StatusDef } from '@daoyou/combat-core/types';
import { getRealmStageLevel as combatCharacterLevel } from '@daoyou/game-domain/progression';
import {
  type TowerNpcPlan,
  TOWER_STRATEGY_VERSION,
  type TowerFloorStrategy,
} from '@daoyou/game-domain/tower';
import { towerStrategyPreview, validateTowerFloorStrategy } from './strategy.js';

/** Bind only matching reference strings; no mechanic names or slot assumptions. */
function bindReferences<T>(value: T, refs: Map<string, string>): T {
  if (typeof value === 'string') return (refs.get(value) ?? value) as T;
  if (Array.isArray(value))
    return value.map((v) => bindReferences(v, refs)) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, bindReferences(v, refs)]),
    ) as T;
  return value;
}

function softenPreview(skills: SkillDef[]) {
  for (const skill of skills) {
    if (skill.id.startsWith('tower.heavy')) {
      skill.effects = skill.effects.map((effect) =>
        effect.type === 'physicalHit' && typeof effect.coeff === 'number'
          ? { ...effect, coeff: Math.round(effect.coeff * 45) / 100 }
          : effect,
      );
    }
    if (skill.id.startsWith('tower.wave')) {
      skill.effects = skill.effects.map((effect) =>
        effect.type === 'spellHit' && typeof effect.power === 'number'
          ? { ...effect, power: Math.round(effect.power * 0.45) }
          : effect,
      );
    }
    if (!skill.id.startsWith('tower.mirror-master') || !skill.hooks) continue;
    skill.hooks = skill.hooks.map((hook) => ({
      ...hook,
      effects: hook.effects.map((effect) =>
        effect.type === 'modifyStrike' && typeof effect.factor === 'string'
          ? { ...effect, factor: effect.factor.replace('0.4', '0.2') }
          : effect,
      ),
    }));
  }
}

export function compileTowerStrategy(
  realm: RealmType,
  f: TowerFloorStrategy,
  version: string,
): CompiledTowerEncounter {
  if (version !== TOWER_STRATEGY_VERSION)
    throw new Error('幻境内容已更新，请重新进入');
  validateTowerFloorStrategy(f);
  if (!Object.prototype.hasOwnProperty.call(pack.baselines, realm))
    throw new Error('幻境境界无效');
  const base = pack.baselines[realm as keyof typeof pack.baselines];
  const { scaling } = pack;
  const preview = towerStrategyPreview(f);
  const plans: Record<string, TowerNpcPlan> = {};
  const skills: SkillDef[] = structuredClone(TOWER_SKILLS);
  const statusDefs: StatusDef[] = structuredClone(TOWER_STATUS_DEFS);
  const passives = new Map(
    f.enemies.map((e) => [
      e.id,
      new Set(e.traits.flatMap((t) => TOWER_CATALOG.traits[t.id].passives)),
    ]),
  );
  const relations = new Set<string>();
  for (const enemy of f.enemies) {
    for (const trait of enemy.traits) {
      const relation = TOWER_CATALOG.traits[trait.id].relation;
      if (!relation || !trait.targetEnemyId) continue;
      const suffix = `.target.${f.enemies.findIndex((e) => e.id === trait.targetEnemyId)}`;
      const identity = `${trait.id}:${trait.targetEnemyId}`;
      if (!relations.has(identity)) {
        const refs = new Map(
          [
            relation.anchorStatus,
            relation.targetPassive,
            relation.sourcePassive,
          ].map((id) => [id, id + suffix]),
        );
        statusDefs.push(
          bindReferences(
            TOWER_STATUS_DEFS.find((s) => s.id === relation.anchorStatus)!,
            refs,
          ),
        );
        for (const id of [relation.targetPassive, relation.sourcePassive])
          skills.push(
            bindReferences(
              TOWER_SKILLS.find((s) => s.id === id)!,
              refs,
            ),
          );
        relations.add(identity);
      }
      passives.get(trait.targetEnemyId)!.add(relation.targetPassive + suffix);
      passives.get(enemy.id)!.add(relation.sourcePassive + suffix);
    }
  }
  const units: CreateBattleInput['units'] = f.enemies.map((e, slot) => {
    const archetype = TOWER_CATALOG.archetypes[e.archetype];
    const behavior = TOWER_CATALOG.behaviors[e.behaviorId];
    const factors: Partial<Record<TowerModifier, number>>[] = [
      TOWER_CATALOG.kinds[f.kind].multiply,
      archetype.multiply,
      archetype.kindMultiply?.[f.kind] ?? {},
      ...e.traits.map((t) => TOWER_CATALOG.traits[t.id].multiply),
    ];
    const scale = (key: TowerModifier) =>
      factors.reduce((v, p) => v * (p[key] ?? 1), 1);
    const add = (key: TowerModifier) =>
      e.traits.reduce(
        (v, t) => v + (TOWER_CATALOG.traits[t.id].add[key] ?? 0),
        0,
      );
    const pool = Math.round(
      base.damagePerRound *
        (1 + scaling.hpGrowth * (f.floor - 1)) *
        scaling.types[f.kind].rounds *
        f.budget.hpScale *
        scale('hp') +
        add('hp'),
    );
    const hp =
      slot === f.enemies.length - 1
        ? pool -
          f.enemies
            .slice(0, slot)
            .reduce(
              (sum, other) => sum + Math.round(pool * other.budgetShare.hp),
              0,
            )
        : Math.round(pool * e.budgetShare.hp);
    const pressure = f.kind === 'normal' ? 0.75 : 1;
    const output =
      ((1 + scaling.outputGrowth * (f.floor - 1)) *
        scaling.types[f.kind].output *
        scale('output') +
        add('output')) *
      pressure;
    const id = `tower.enemy.${slot}`;
    plans[id] = { cycle: [...behavior.cycle], fallback: behavior.fallback };
    const mp = behavior.maxMp ?? TOWER_CATALOG.defaults.maxMp;
    return {
      id,
      name: preview.members[slot].name,
      side: 1,
      slot,
      kind: UnitKind.Npc,
      level: combatCharacterLevel(realm, pack.floors[f.floor - 1].realmStage),
      attrs: {
        hp,
        maxHp: hp,
        mp,
        maxMp: mp,
        physicalAtk: Math.round(
          base.referencePhysicalDef +
            (base.physicalAtk - base.referencePhysicalDef) *
              output *
              e.budgetShare.output,
        ),
        magicAtk: Math.round(
          base.referenceMagicDef +
            (base.magicAtk - base.referenceMagicDef) *
              output *
              e.budgetShare.output,
        ),
        physicalDef: Math.round(
          (base.physicalDef *
            (1 + scaling.defenseGrowth * (f.floor - 1)) *
            scale('physicalDef') +
            add('physicalDef')) *
            (f.kind === 'normal' ? 0.75 : 1),
        ),
        magicDef: Math.round(
          (base.magicDef *
            (1 + scaling.defenseGrowth * (f.floor - 1)) *
            scale('magicDef') +
            add('magicDef')) *
            (f.kind === 'normal' ? 0.75 : 1),
        ),
        speed: Math.round(base.speed * scale('speed') + add('speed')),
        hit: base.hit,
        dodge: base.dodge,
        critRate:
          TOWER_CATALOG.defaults.critRate * scale('critRate') + add('critRate'),
        spellCritRate:
          TOWER_CATALOG.defaults.spellCritRate * scale('spellCritRate') +
          add('spellCritRate'),
        sealHit:
          TOWER_CATALOG.defaults.sealHit * scale('sealHit') + add('sealHit'),
        sealResist:
          TOWER_CATALOG.defaults.sealResist * scale('sealResist') +
          add('sealResist'),
        attackCultivate: base.cultivate,
        spellCultivate: base.cultivate,
        defenseCultivate: base.cultivate,
        resistSpellCultivate: base.cultivate,
      },
      skills: [
        ...new Set(
          [...behavior.cycle, behavior.fallback].filter(
            (s) => s !== 'attack' && s !== 'defend',
          ),
        ),
      ],
      passives: [...passives.get(e.id)!],
      tags: [e.role === 'support' ? 'tower-support' : 'tower-leader'],
    };
  });
  if (units.some((u) => (u.attrs.maxHp ?? 0) < 1))
    throw new Error('幻境气血预算不足');
  if (f.kind === 'normal') softenPreview(skills);
  return { units, plans, skills, statusDefs };
}
