import type { TowerBlessings, TowerBattleSnapshot } from '@daoyou/game-domain/tower';
import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

import { playerAppearances } from '../combat/unit-appearance.js';

import { TOWER_BLESSINGS_PACK } from '@daoyou/game-content/tower';

import {
  TOWER_CONTENT_VERSION,
  type TowerWeek,
} from './weekly.js';

import type { RealmType } from '@daoyou/constants/realms';

import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';

import { projectBeastRoster } from '../beasts/projection.js';

import { isStanding } from '@daoyou/combat-core/units';

import { type Attrs, type SkillDef } from '@daoyou/combat-core/types';

import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';

import {
  type PveRestoredState,
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
} from '@daoyou/game-domain/combat';

import { CombatV6PveHostSession } from '../combat/encounter/host.js';

import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';

import { daoyouRulesetV6 } from '../combat/daoyou/index.js';


import { compileTowerEncounter } from './content.js';

import { type PublishedTowerWeek } from '@daoyou/game-domain/tower';

import { publishedTowerEncounter } from './published.js';

export const TOWER_V6_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v12',
  contentVersion: TOWER_CONTENT_VERSION,
} as const;

function blessingStacks(
  blessings: TowerBlessings,
  id: keyof TowerBlessings,
  maxStacks: number,
) {
  return Math.max(0, Math.min(maxStacks, Math.floor(blessings[id] ?? 0)));
}

function rememberPassive(unit: { passives?: string[] }, id: string) {
  unit.passives = [...(unit.passives ?? []), id];
}

type BlessingUnit = { attrs: Partial<Attrs>; passives?: string[] };

function scaleAttribute(unit: BlessingUnit, key: keyof Attrs, factor: number) {
  const next = Math.floor((unit.attrs[key] ?? 0) * factor);
  unit.attrs[key] = next;
  if (key === 'maxHp') unit.attrs.hp = next;
}

function strikePassive(
  id: string,
  name: string,
  incoming: boolean,
  factor: number,
): SkillDef {
  return {
    id,
    name,
    tags: ['passive'],
    targeting: { side: 'self' },
    effects: [],
    hooks: [
      {
        on: 'onHitCalc',
        sourceIsSelf: !incoming,
        targetIsSelf: incoming,
        effects: [{ type: 'modifyStrike', factor }],
      },
    ],
  };
}

/** Stacks add within a blessing. Different blessings stay active together. */
export function applyTowerBlessings(
  player: BlessingUnit,
  beasts: BlessingUnit[],
  blessings: TowerBlessings,
  pack = TOWER_BLESSINGS_PACK,
): SkillDef[] {
  const skills: SkillDef[] = [];
  for (const rule of pack.blessings) {
    const stacks = blessingStacks(blessings, rule.id, rule.maxStacks);
    if (!stacks) continue;
    const effect = rule.effect;
    const units = effect.target === 'beasts' ? beasts : [player];
    if (effect.kind === 'attributes') {
      const factor = 1 + stacks * effect.perStack;
      for (const unit of units)
        for (const key of effect.attributes) scaleAttribute(unit, key, factor);
      continue;
    }
    if (effect.kind === 'crit') {
      for (const unit of units) {
        unit.attrs.critRate = (unit.attrs.critRate ?? 0) + stacks * effect.perStack;
        unit.attrs.spellCritRate =
          (unit.attrs.spellCritRate ?? 0) + stacks * effect.perStack;
      }
      continue;
    }
    const id = `tower.blessing.${rule.id}`;
    const incoming = effect.kind === 'damageTaken';
    const factor = incoming
      ? 1 - stacks * effect.perStack
      : 1 + stacks * effect.perStack;
    for (const unit of units) rememberPassive(unit, id);
    skills.push(strikePassive(id, rule.name, incoming, factor));
  }
  return skills;
}

export function projectTowerPlayer(
  player: CombatV6TrainingPlayerInput,
  blessings: TowerBlessings,
  pack = TOWER_BLESSINGS_PACK,
) {
  const projected = projectCharacterToCombatV6({
    ...structuredClone(player),
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  applyTowerBlessings(projected.unit, [], blessings, pack);
  return projected;
}

export class TowerHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      TowerBattleSnapshot,
      'version' | 'playerId' | 'input' | 'npcPlans'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'tower-v6-v9' ||
      source.input.versions?.contentVersion !== TOWER_CONTENT_VERSION ||
      !source.npcPlans
    )
      throw new Error('幻境内容已更新，请重新进入');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: {},
        sourceProjectionVersions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
        playerAutoStrategy: source.input.autoStrategy,
      },
      restored,
      source.input.unitAppearances,
    );
  }
  override resolveRound(
    afterAction?: Parameters<CombatV6PveHostSession['resolveRound']>[0],
  ) {
    // Plans are frozen with the battle. Missed/sealed actions never shift the cycle.
    // The shared engine still checks resources, status restrictions, targets and damage.
    if (!this.finished && this.state.phase === 'command') {
      for (const unit of this.state.units.filter(
        (u) => u.side === 1 && isStanding(u),
      )) {
        if (unit.command) continue;
        const plan = this.source.npcPlans?.[unit.id];
        if (!plan) throw new Error('幻境缺少行动方案');
        let action = plan.cycle[(this.state.round - 1) % plan.cycle.length];
        const options = this.battle.queryCommands(unit.id);
        const planned = options.skills.find((s) => s.skillId === action);
        if (planned && unit.attrs.mp < planned.costs.mp) action = plan.fallback;
        if (!options.canSubmit) continue;
        const skill = options.skills.find((s) => s.skillId === action);
        if (skill?.selectableTargetIds.length) {
          this.battle.submit(unit.id, {
            type: 'skill',
            skillId: action,
            targets: skill.selectableTargetIds.slice(0, skill.targetCount),
          });
        } else if (action === 'attack' && options.attackTargetIds[0]) {
          this.battle.submit(unit.id, {
            type: 'attack',
            target: options.attackTargetIds[0],
          });
        } else this.battle.submit(unit.id, { type: 'defend' });
      }
    }
    return super.resolveRound(afterAction);
  }
  runtimeSnapshot(): TowerBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }
  trace() {
    return this.traceData();
  }
}

export function createTowerHost(
  player: CombatV6TrainingPlayerInput,
  realm: RealmType,
  floor: number,
  blessings: TowerBlessings,
  week: TowerWeek | undefined,
  seed: number,
  published?: PublishedTowerWeek,
) {
  if (!published && !week) throw new Error('幻境周配置缺失');
  const projected = projectCharacterToCombatV6({
    ...structuredClone(player),
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const unit = projected.unit;
  const beasts = projectBeastRoster(player.beasts, unit.id!, 0, 0, unit.level);
  const blessingSkills = applyTowerBlessings(unit, beasts, blessings);
  const enemies = published
    ? publishedTowerEncounter(published, realm, floor)
    : compileTowerEncounter(realm, floor, week!);
  return new TowerHost({
    version: 'tower-v6-v9',
    playerId: unit.id!,
    npcPlans: enemies.plans,
    input: {
      autoStrategy: player.autoStrategy,
      unitAppearances: playerAppearances(player),
      seed,
      versions: {
        ...TOWER_V6_VERSIONS,
        contentVersion: published?.contentVersion ?? week!.version,
      },
      units: [unit, ...beasts, ...enemies.units],
      skills: [
        ...projected.skills,
        ...BEAST_SKILLS,
        ...blessingSkills,
        ...enemies.skills,
      ],
      statusDefs: [
        ...projected.statusDefs,
        ...BEAST_STATUS_DEFS,
        ...enemies.statusDefs,
      ],
    },
  });
}
