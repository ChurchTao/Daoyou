import { UnitKind } from '@daoyou/combat-core/enums';
import type { CreateBattleInput } from '@daoyou/combat-core/types';
import type { RealmType } from '@daoyou/constants/realms';
import { earlyBaselines } from '@daoyou/game-content/combat/early-baselines';
import {
  EXORCISM_BOSSES,
  EXORCISM_ENCOUNTER_PACK,
  EXORCISM_LINEAGES,
  EXORCISM_SKILLS,
  EXORCISM_STATUS_DEFS,
  type ExorcismEncounterDef,
} from '@daoyou/game-content/dungeon/exorcism';
import { TOWER_ENCOUNTER_PACK } from '@daoyou/game-content/tower';
import type { CombatV6UnitAppearance } from '@daoyou/game-domain/combat';
import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import type {
  ExorcismBossId,
  ExorcismLineageId,
  ExorcismNpcPlan,
} from '@daoyou/game-domain/dungeon/exorcism';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';

function baselineOf(realm: RealmType) {
  if (realm === '炼气' || realm === '筑基')
    return { ...earlyBaselines[realm], cultivate: 0, sealHit: 0 };
  return TOWER_ENCOUNTER_PACK.baselines[realm];
}

/** 取这一场的编组：前两战看祟脉，第三战是首领的护法，第四战是首领。 */
export function exorcismEncounterDef(
  stage: number,
  bossId: ExorcismBossId,
  lineageId: ExorcismLineageId,
): ExorcismEncounterDef {
  if (stage === 1) return EXORCISM_LINEAGES[lineageId].scout;
  if (stage === 2) return EXORCISM_LINEAGES[lineageId].ambush;
  if (stage === 3) return EXORCISM_BOSSES[bossId].guardian;
  if (stage === 4) return EXORCISM_BOSSES[bossId].boss;
  throw new Error('除祟场次无效');
}

export interface CompiledExorcismEncounter {
  units: CreateBattleInput['units'];
  plans: Record<string, ExorcismNpcPlan>;
  appearances: Record<string, CombatV6UnitAppearance>;
}

/** 预算属于整场，不读取玩家战力。节点系数同时作用于气血和输出。 */
export function compileExorcismEncounter(input: {
  realm: RealmType;
  tier: DungeonDifficultyTier;
  stage: number;
  bossId: ExorcismBossId;
  lineageId: ExorcismLineageId;
  pack?: typeof EXORCISM_ENCOUNTER_PACK;
}): CompiledExorcismEncounter {
  const pack = input.pack ?? EXORCISM_ENCOUNTER_PACK;
  const budget = pack.stages[input.stage - 1];
  if (!budget) throw new Error('除祟场次无效');
  const tier = pack.tiers[input.tier];
  const realmFactor = pack.realmFactors[input.realm] ?? 1;
  const factor = tier.factor * realmFactor;
  const base = baselineOf(input.realm);
  const level = getRealmStageLevel(input.realm, tier.enemyStage);
  const def = exorcismEncounterDef(input.stage, input.bossId, input.lineageId);
  const mp = 100 + level * 10;
  const plans: Record<string, ExorcismNpcPlan> = {};
  const appearances: Record<string, CombatV6UnitAppearance> = {};
  const units: CreateBattleInput['units'] = def.enemies.map((enemy, slot) => {
    const id = `exorcism.enemy.${slot}`;
    plans[id] = { cycle: [...enemy.cycle], fallback: enemy.fallback };
    appearances[id] = { icon: `icon:portrait-${enemy.portrait}` };
    const mods = enemy.modifiers ?? {};
    const hp = Math.max(
      1,
      Math.round(
        base.damagePerRound *
          budget.rounds *
          factor *
          (def.hpScale ?? 1) *
          enemy.hpShare *
          (mods.hp ?? 1),
      ),
    );
    const output = budget.output * factor * enemy.outputShare;
    const passives = [...(enemy.passives ?? [])];
    // 祟蚀挂在场上第一个敌人身上，整场只生效一份。
    if (slot === 0 && input.stage >= pack.corrosion.fromStage)
      passives.push('exorcism.corrosion');
    if (slot === 0 && input.stage >= pack.taint.stage)
      passives.push('exorcism.taint-aura');
    const late = input.stage >= pack.corrosion.fromStage;
    if (late) passives.push('exorcism.true-sight');
    return {
      id,
      name: enemy.name,
      side: 1 as const,
      slot,
      kind: UnitKind.Npc,
      level,
      attrs: {
        hp,
        maxHp: hp,
        mp,
        maxMp: mp,
        physicalAtk: Math.round(
          base.referencePhysicalDef +
            (base.physicalAtk - base.referencePhysicalDef) * output,
        ),
        magicAtk: Math.round(
          base.referenceMagicDef +
            (base.magicAtk - base.referenceMagicDef) * output,
        ),
        physicalDef: Math.round(base.physicalDef * (mods.physicalDef ?? 1)),
        magicDef: Math.round(base.magicDef * (mods.magicDef ?? 1)),
        speed: Math.round(base.speed * (mods.speed ?? 1)),
        hit: base.hit,
        dodge: Math.round(base.dodge * (mods.dodge ?? 1)),
        healPower: 0,
        critRate: 0,
        spellCritRate: 0,
        physicalFuryRate: 0,
        sealHit: Math.max(base.sealHit, level),
        sealResist: late ? pack.bossSealResist : 0,
        attackCultivate: base.cultivate,
        defenseCultivate: base.cultivate,
        spellCultivate: base.cultivate,
        resistSpellCultivate: base.cultivate,
      },
      skills: [
        ...new Set(enemy.cycle.filter((id) => id.startsWith('exorcism.'))),
      ],
      passives,
      tags: [],
    };
  });
  return { units, plans, appearances };
}

export { EXORCISM_SKILLS, EXORCISM_STATUS_DEFS };
