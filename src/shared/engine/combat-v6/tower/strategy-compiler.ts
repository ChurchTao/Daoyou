import type { RealmType } from '../../../types/constants';
import { UnitKind, type CreateBattleInput } from '../core';
import type { TowerNpcPlan } from './content';
import {
  hasTowerTrait,
  TOWER_STRATEGY_VERSION,
  towerStrategyPreview,
  validateTowerFloorStrategy,
  type TowerFloorStrategy,
} from './strategy';
import { TOWER_SKILLS, TOWER_STATUS_DEFS } from './strategy-content-v5';
import pack from './strategy-scaling-v5.json';

/** Immutable v5 semantics: add another versioned compiler for future rule changes. */
export function compileTowerStrategy(
  realm: RealmType,
  f: TowerFloorStrategy,
  version: string,
) {
  if (version !== TOWER_STRATEGY_VERSION)
    throw new Error('幻境内容版本无法恢复');
  validateTowerFloorStrategy(f);
  if (!Object.prototype.hasOwnProperty.call(pack.baselines, realm))
    throw new Error('幻境境界无效');
  const base = pack.baselines[realm as keyof typeof pack.baselines];
  const { scaling } = pack;
  const preview = towerStrategyPreview(f);
  const plans: Record<string, TowerNpcPlan> = {};
  const skills = structuredClone(TOWER_SKILLS);
  const statusDefs = structuredClone(TOWER_STATUS_DEFS);
  const guardTargets = [
    ...new Set(
      f.enemies.flatMap((e) =>
        e.traits.flatMap((t) => (t.id === 'guard' ? [t.targetEnemyId] : [])),
      ),
    ),
  ];
  // The original first-slot anchor keeps v4 definitions byte-for-byte equivalent.
  const suffix = (id: string) =>
    f.enemies.findIndex((e) => e.id === id) === 0
      ? ''
      : `.target.${f.enemies.findIndex((e) => e.id === id)}`;
  for (const target of guardTargets) {
    const s = suffix(target);
    if (!s) continue;
    const anchor = structuredClone(TOWER_STATUS_DEFS[0]);
    anchor.id += s;
    anchor.kind += s;
    statusDefs.push(anchor);
    const master = structuredClone(TOWER_SKILLS[0]);
    master.id += s;
    master.innate!.entryStatus!.statusId += s;
    skills.push(master);
    const guard = structuredClone(TOWER_SKILLS[1]);
    guard.id += s;
    guard.hooks![0].targeting!.requireStatusIds = [anchor.id];
    skills.push(guard);
  }
  const hpMods = f.enemies.map((e) =>
    hasTowerTrait(e, 'vital')
      ? f.kind === 'normal'
        ? 1.25
        : 1.15
      : f.kind === 'normal'
        ? 1
        : 0.92,
  );
  const units: CreateBattleInput['units'] = f.enemies.map((e, slot) => {
    const has = (id: Parameters<typeof hasTowerTrait>[1]) =>
      hasTowerTrait(e, id);
    const support = e.archetype === 'attendant';
    const hpMod = hpMods[slot];
    const pool = Math.round(
      base.hp *
        (1 + scaling.hpGrowth * (f.floor - 1)) *
        scaling.types[f.kind].hp *
        hpMod *
        f.budget.hpScale,
    );
    // Round each member against its own pool. Only the final slot carries the
    // rounding remainder; changing one enemy's vitality never changes a peer.
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
    const defense = support ? 0.65 : f.kind === 'normal' ? 1 : 0.8;
    const output =
      (1 + scaling.outputGrowth * (f.floor - 1)) *
      scaling.types[f.kind].output *
      (f.kind === 'boss' ? 0.95 : 1) *
      (e.archetype === 'binder' ? 0.65 : 1);
    const cycle = has('limited_healing')
      ? ['tower.support-strike', 'tower.support-strike', 'tower.heal']
      : has('charge')
        ? ['tower.charge', 'tower.heavy', 'attack']
        : support
          ? ['tower.support-strike']
          : e.archetype === 'binder'
            ? ['tower.seal', 'tower.bolt', 'tower.bolt']
            : e.archetype === 'mage'
              ? ['tower.bolt', 'tower.bolt', 'tower.wave']
              : f.kind === 'normal'
                ? ['attack', 'attack', 'tower.strike']
                : ['tower.strike', 'tower.strike', 'tower.double'];
    const id = `tower.enemy.${slot}`;
    plans[id] = { cycle };
    const guard = e.traits.find((t) => t.id === 'guard');
    return {
      id,
      name: preview.members[slot].name,
      side: 1,
      slot,
      kind: UnitKind.Npc,
      level: base.level,
      attrs: {
        hp,
        maxHp: hp,
        mp: has('limited_healing') ? 36 : 1500,
        maxMp: has('limited_healing') ? 36 : 1500,
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
            (has('armor') ? (support ? 0.65 * 1.5625 : 1.25) : defense),
        ),
        magicDef: Math.round(
          base.magicDef *
            (1 + scaling.defenseGrowth * (f.floor - 1)) *
            (has('magic_ward') ? (support ? 0.65 * 1.5 : 1.2) : defense),
        ),
        speed: Math.round(
          base.speed *
            (has('swift')
              ? support
                ? (0.85 * 1.1) / 0.95
                : 1.1
              : has('charge')
                ? 0.8
                : support
                  ? 0.85
                  : 0.95),
        ),
        hit: base.hit,
        dodge: base.dodge,
        critRate: 0.03,
        spellCritRate: 0.03,
        sealHit: 45,
        sealResist: has('seal_resist') ? 60 : 50,
      },
      skills: [...new Set(cycle.filter((s) => s !== 'attack'))],
      passives: [
        ...(has('last_stand') ? ['tower.last-stand'] : []),
        ...(guardTargets.includes(e.id)
          ? [`tower.mirror-master${suffix(e.id)}`]
          : []),
        ...(guard?.id === 'guard'
          ? [`tower.mirror-guard${suffix(guard.targetEnemyId)}`]
          : []),
      ],
      tags: [],
    };
  });
  if (units.some((u) => (u.attrs.maxHp ?? 0) < 1))
    throw new Error('幻境气血预算不足');
  return { units, plans, skills, statusDefs };
}
