import { TOWER_ENCOUNTER_PACK as pack } from '../../../lib/tower/encounter-pack';
import type { RealmType } from '../../../types/constants';
import {
  UnitKind,
  type CreateBattleInput,
  type SkillDef,
  type StatusDef,
} from '../core';
import { combatCharacterLevel } from '../projection/character-level';
import {
  TOWER_CATALOG,
  TOWER_SKILLS,
  TOWER_STATUS_DEFS,
  type TowerModifier,
  type TowerNpcPlan,
} from './catalog';
import {
  TOWER_STRATEGY_VERSION,
  towerStrategyPreview,
  validateTowerFloorStrategy,
  type TowerFloorStrategy,
} from './strategy';

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
export function compileTowerStrategy(
  realm: RealmType,
  f: TowerFloorStrategy,
  version: string,
) {
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
      base.hp *
        (1 + scaling.hpGrowth * (f.floor - 1)) *
        scaling.types[f.kind].hp *
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
    const output =
      (1 + scaling.outputGrowth * (f.floor - 1)) *
        scaling.types[f.kind].output *
        scale('output') +
      add('output');
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
          base.physicalDef *
            (1 + scaling.defenseGrowth * (f.floor - 1)) *
            scale('physicalDef') +
            add('physicalDef'),
        ),
        magicDef: Math.round(
          base.magicDef *
            (1 + scaling.defenseGrowth * (f.floor - 1)) *
            scale('magicDef') +
            add('magicDef'),
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
      },
      skills: [
        ...new Set(
          [...behavior.cycle, behavior.fallback].filter(
            (s) => s !== 'attack' && s !== 'defend',
          ),
        ),
      ],
      passives: [...passives.get(e.id)!],
      tags: [],
    };
  });
  if (units.some((u) => (u.attrs.maxHp ?? 0) < 1))
    throw new Error('幻境气血预算不足');
  return { units, plans, skills, statusDefs };
}
