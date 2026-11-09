import { isStanding } from '@daoyou/combat-core/units';
import type { RealmType } from '@daoyou/constants/realms';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import {
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  type CombatV6TrainingPlayerInput,
  type PveRestoredState,
} from '@daoyou/game-domain/combat';
import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';
import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import type {
  ExorcismBattleSnapshot,
  ExorcismResources,
  ExorcismRunState,
} from '@daoyou/game-domain/dungeon/exorcism';
import { projectBeastRoster } from '../../beasts/projection.js';
import { daoyouRulesetV6 } from '../../combat/daoyou/index.js';
import { CombatV6PveHostSession } from '../../combat/encounter/host.js';
import { projectCharacterToCombatV6 } from '../../combat/projection/project-character.js';
import { playerAppearances } from '../../combat/unit-appearance.js';
import {
  compileExorcismEncounter,
  EXORCISM_SKILLS,
  EXORCISM_STATUS_DEFS,
} from './encounter.js';
import { exorcismCurrentStage } from './state.js';

export const EXORCISM_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v13' as const,
  contentVersion: 'combat-v6-exorcism-v1' as const,
};

export class ExorcismHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      ExorcismBattleSnapshot,
      'version' | 'playerId' | 'input' | 'npcPlans'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'exorcism-v6-v1' ||
      source.input.versions?.contentVersion !== EXORCISM_VERSIONS.contentVersion
    )
      throw new Error('除祟战斗版本无法恢复');
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
    // 行动方案随战斗冻结：被控制错过一步不会错位。合法性仍由引擎检查。
    if (!this.finished && this.state.phase === 'command') {
      for (const unit of this.state.units.filter(
        (u) => u.side === 1 && isStanding(u),
      )) {
        if (unit.command) continue;
        const plan = this.source.npcPlans[unit.id];
        if (!plan) throw new Error('除祟敌人缺少行动方案');
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
        } else if (action !== 'defend' && options.attackTargetIds[0]) {
          this.battle.submit(unit.id, {
            type: 'attack',
            target: options.attackTargetIds[0],
          });
        } else this.battle.submit(unit.id, { type: 'defend' });
      }
    }
    return super.resolveRound(afterAction);
  }

  runtimeSnapshot(): ExorcismBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }

  trace() {
    return this.traceData();
  }

  /** 战斗结束时的局内资源，交给 applyExorcismBattle 入账。 */
  finalResources(): ExorcismResources {
    const units = this.state.units;
    const player = units.find((u) => u.id === this.playerId);
    if (!player) throw new Error('除祟战局缺少人物');
    const pick = (u: (typeof units)[number]) => ({
      hp: Math.max(0, Math.floor(u.attrs.hp)),
      mp: Math.max(0, Math.floor(u.attrs.mp)),
      maxHp: u.attrs.maxHp,
      maxMp: u.attrs.maxMp,
    });
    return {
      player: pick(player),
      beasts: Object.fromEntries(
        units
          .filter((u) => u.ownerId === this.playerId)
          .map((u) => [u.id, pick(u)]),
      ),
    };
  }
}

/**
 * 局内资源独立：按满状态投影，再覆盖成本局累计值。
 * 不读取、也不写回人物现实气血法力。已阵亡的灵兽不再上场。
 */
export function createExorcismHost(
  player: CombatV6TrainingPlayerInput,
  encounter: { realm: RealmType; tier: DungeonDifficultyTier },
  run: Pick<ExorcismRunState, 'wins' | 'bossId' | 'lineageId' | 'resources'>,
  seed: number,
) {
  const projected = projectCharacterToCombatV6({
    ...structuredClone(player),
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const unit = projected.unit;
  const carried = run.resources;
  if (carried) {
    unit.attrs = {
      ...unit.attrs,
      hp: Math.min(unit.attrs?.maxHp ?? carried.player.hp, carried.player.hp),
      mp: Math.min(unit.attrs?.maxMp ?? carried.player.mp, carried.player.mp),
    };
  }
  const beasts = projectBeastRoster(
    player.beasts,
    unit.id!,
    0,
    0,
    unit.level,
  ).flatMap((beast) => {
    const previous = carried?.beasts[beast.id!];
    if (!previous) return [beast];
    if (previous.hp <= 0) return [];
    return [
      {
        ...beast,
        attrs: {
          ...beast.attrs,
          hp: Math.min(beast.attrs?.maxHp ?? previous.hp, previous.hp),
          mp: Math.min(beast.attrs?.maxMp ?? previous.mp, previous.mp),
        },
      },
    ];
  });
  const compiled = compileExorcismEncounter({
    ...encounter,
    stage: exorcismCurrentStage(run),
    bossId: run.bossId,
    lineageId: run.lineageId,
  });
  return new ExorcismHost({
    version: 'exorcism-v6-v1',
    playerId: unit.id!,
    npcPlans: compiled.plans,
    input: {
      autoStrategy: player.autoStrategy,
      unitAppearances: {
        ...playerAppearances(player),
        ...compiled.appearances,
      },
      seed,
      versions: EXORCISM_VERSIONS,
      units: [unit, ...beasts, ...compiled.units],
      skills: [...projected.skills, ...BEAST_SKILLS, ...EXORCISM_SKILLS],
      statusDefs: [
        ...projected.statusDefs,
        ...BEAST_STATUS_DEFS,
        ...EXORCISM_STATUS_DEFS,
      ],
    },
  });
}
