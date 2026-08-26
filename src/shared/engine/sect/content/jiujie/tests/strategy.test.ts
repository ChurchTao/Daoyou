import type { AbilitySelectionCandidate } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { AttributeType, BuffType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { BuffFactory } from '@shared/engine/battle-v5/factories/BuffFactory';
import { Unit } from '@shared/engine/battle-v5/units/Unit';
import { describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbility } from '../..';
import type { CultivatorSectState, SectTacticId } from '../../../core';
import {
  JIUJIE_CALAMITY,
  JIUJIE_CONDEMNATION_PATH_ID,
  JIUJIE_EYE,
  JIUJIE_EYE_PATH_ID,
  JIUJIE_THUNDER,
  jiujieTag,
} from '../ids';
import {
  JiujieBaseSelectionStrategy,
  JiujieCondemnationSelectionStrategy,
  JiujieEyeSelectionStrategy,
} from '../strategy';

type PathId = typeof JIUJIE_EYE_PATH_ID | typeof JIUJIE_CONDEMNATION_PATH_ID;

const ALL_ABILITIES = [
  'heaven-hearing',
  'receive-calamity',
  'calamity-seal',
  'thunder-prison-question',
  'borrow-calamity',
  'causal-echo',
  'nine-sky-settlement',
] as const;

function state(pathId?: PathId, tacticId?: SectTacticId, nodeIds: string[] = []): CultivatorSectState {
  return {
    membershipId: 'jiujie-strategy',
    sectId: 'jiujie',
    status: 'active',
    contribution: 0,
    configVersion: 1,
    activePathId: pathId,
    methods: {
      'jiujie-canon': 100,
      'calamity-eye': 100,
      'heavenly-record': 100,
      'thunder-prison': 100,
      'cause-judgment': 100,
      'crossing-calamity': 100,
    },
    paths: pathId
      ? [
          {
            pathId,
            unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
            tacticId:
              tacticId ??
              (pathId === JIUJIE_EYE_PATH_ID
                ? 'bear-and-return'
                : 'record-and-judge'),
            activeMeridianSlot: 1,
            meridianLoadouts: [
              { slot: 1, nodeIds, version: 1 },
              { slot: 2, nodeIds: [], version: 1 },
              { slot: 3, nodeIds: [], version: 1 },
            ],
          },
        ]
      : [],
    abilityLoadout: [
      'heaven-hearing',
      'receive-calamity',
      'thunder-prison-question',
      'nine-sky-settlement',
    ],
  };
}

function unit(id: string): Unit {
  return new Unit(id, id, {
    [AttributeType.VITALITY]: 100,
    [AttributeType.SPIRIT]: 100,
    [AttributeType.ENDURANCE]: 100,
    [AttributeType.SPEED]: 100,
    [AttributeType.WILLPOWER]: 100,
  });
}

function addBuff(target: Unit, id: string, type = BuffType.BUFF): void {
  target.buffs.addBuff(
    BuffFactory.create({ id, name: id, type, duration: 3 }),
    target,
  );
}

function context(
  pathId: PathId | undefined,
  tacticId: SectTacticId | undefined,
  setup?: (caster: Unit, opponent: Unit) => void,
  abilityIds: readonly string[] = ALL_ABILITIES,
  nodeIds: string[] = [],
) {
  const sect = state(pathId, tacticId, nodeIds);
  const caster = unit('caster');
  const opponent = unit('opponent');
  caster.combatResources.define({
    id: JIUJIE_CALAMITY,
    name: '劫数',
    initial: 0,
    max: 3,
  });
  setup?.(caster, opponent);
  const candidates: AbilitySelectionCandidate[] = abilityIds.flatMap(
    (abilityId, order) => {
      const ability = AbilityFactory.create(
        resolveSectAbility({ sect, realm: '化神', abilityId }).config,
      ) as ActiveSkill;
      ability.setOwner(caster);
      ability.setActive(true);
      const target = ability.targetPolicy.team === 'enemy' ? opponent : caster;
      return ability.canTrigger({ caster, target })
        ? [{ ability, target, order }]
        : [];
    },
  );
  return { caster, opponent, candidates };
}

function openEye(caster: Unit): void {
  addBuff(caster, 'sect.jiujie.receive-calamity');
  addBuff(caster, JIUJIE_EYE);
}

function markThunder(opponent: Unit): void {
  opponent.buffs.addBuff(
    BuffFactory.create({
      id: JIUJIE_THUNDER,
      name: '劫雷',
      type: BuffType.DEBUFF,
      duration: 3,
      tags: [jiujieTag('thunder'), jiujieTag('calamity')],
      statusTags: [jiujieTag('thunder'), jiujieTag('calamity')],
    }),
    opponent,
  );
}

describe('九劫天宫自动施法策略', () => {
  it('按当前流派投影对应策略', () => {
    expect(
      projectSectCombat({ sect: state(), realm: '化神' })?.selectionStrategy,
    ).toBeInstanceOf(JiujieBaseSelectionStrategy);
    expect(
      projectSectCombat({
        sect: state(JIUJIE_EYE_PATH_ID),
        realm: '化神',
      })?.selectionStrategy,
    ).toBeInstanceOf(JiujieEyeSelectionStrategy);
    expect(
      projectSectCombat({
        sect: state(JIUJIE_CONDEMNATION_PATH_ID),
        realm: '化神',
      })?.selectionStrategy,
    ).toBeInstanceOf(JiujieCondemnationSelectionStrategy);
  });

  it('劫眼开局优先释放承天受劫', () => {
    const battle = context(JIUJIE_EYE_PATH_ID, 'bear-and-return');
    const result = new JiujieEyeSelectionStrategy('bear-and-return').select(
      battle,
    );

    expect(result?.ability.id).toBe('sect.jiujie.receive-calamity');
    expect(result?.target).toBe(battle.caster);
  });

  it('承天状态尚在但劫眼已结束时会重新开眼', () => {
    const battle = context(JIUJIE_EYE_PATH_ID, 'bear-and-return', (caster) =>
      addBuff(caster, 'sect.jiujie.receive-calamity'),
    );

    expect(
      new JiujieEyeSelectionStrategy('bear-and-return').select(battle)?.ability
        .id,
    ).toBe('sect.jiujie.receive-calamity');
  });

  it.each([
    ['劫眼临身', JIUJIE_EYE_PATH_ID, 'bear-and-return'],
    ['天谴加身', JIUJIE_CONDEMNATION_PATH_ID, 'record-and-judge'],
  ] as const)('%s达到两点劫数后优先九霄清算', (_label, pathId, tacticId) => {
    const battle = context(pathId, tacticId, (caster, opponent) => {
      caster.combatResources.set(JIUJIE_CALAMITY, 2);
      markThunder(opponent);
      if (pathId === JIUJIE_EYE_PATH_ID) openEye(caster);
    });

    const strategy =
      pathId === JIUJIE_EYE_PATH_ID
        ? new JiujieEyeSelectionStrategy(tacticId)
        : new JiujieCondemnationSelectionStrategy(tacticId);
    expect(strategy.select(battle)?.ability.id).toBe(
      'sect.jiujie.nine-sky-settlement',
    );
  });

  it('闭目守劫仅在低血时消耗一点劫数换取护盾', () => {
    const healthy = context(
      JIUJIE_EYE_PATH_ID,
      'close-the-eye',
      (caster, opponent) => {
        caster.combatResources.set(JIUJIE_CALAMITY, 1);
        openEye(caster);
        markThunder(opponent);
      },
    );
    expect(
      new JiujieEyeSelectionStrategy('close-the-eye').select(healthy)?.ability
        .id,
    ).toBe('sect.jiujie.thunder-prison-question');

    const endangered = context(
      JIUJIE_EYE_PATH_ID,
      'close-the-eye',
      (caster, opponent) => {
        caster.combatResources.set(JIUJIE_CALAMITY, 1);
        caster.setHp(Math.floor(caster.getMaxHp() * 0.4));
        openEye(caster);
        markThunder(opponent);
      },
    );
    expect(
      new JiujieEyeSelectionStrategy('close-the-eye').select(endangered)
        ?.ability.id,
    ).toBe('sect.jiujie.borrow-calamity');
  });

  it('天谴两种起手分别遵守落印与天听偏好', () => {
    expect(
      new JiujieCondemnationSelectionStrategy('record-and-judge').select(
        context(JIUJIE_CONDEMNATION_PATH_ID, 'record-and-judge'),
      )?.ability.id,
    ).toBe('sect.jiujie.calamity-seal');
    expect(
      new JiujieCondemnationSelectionStrategy('listen-to-heaven').select(
        context(JIUJIE_CONDEMNATION_PATH_ID, 'listen-to-heaven'),
      )?.ability.id,
    ).toBe('sect.jiujie.heaven-hearing');
  });

  it('重典战术在满债且劫数未满时优先使用带重法催审语义的因果回响', () => {
    const battle = context(
      JIUJIE_CONDEMNATION_PATH_ID,
      'heavy-statute',
      (caster, opponent) => {
        caster.combatResources.set(JIUJIE_CALAMITY, 2);
        markThunder(opponent);
        const debt = BuffFactory.create({
          id: 'sect.jiujie.debt',
          name: '劫债',
          type: BuffType.DEBUFF,
          duration: 4,
          maxLayers: 3,
          stackRule: StackRule.STACK_LAYER,
        });
        opponent.buffs.addBuff(debt, caster);
        debt.addLayer(2);
      },
      ALL_ABILITIES,
      ['condemnation-heavy-statute'],
    );

    expect(
      new JiujieCondemnationSelectionStrategy('heavy-statute').select(battle)
        ?.ability.id,
    ).toBe('sect.jiujie.causal-echo');
  });
});
