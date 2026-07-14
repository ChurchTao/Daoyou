import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import { AttributeType, BuffType, ModifierType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { RealmType } from '@shared/types/constants';
import type {
  CultivatorSectState,
  SectCompiledBuild,
  SectProjectionContext,
} from '../../../types';
import {
  active,
  consumeResource,
  damage,
  healMaxHp,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
  manaCost,
  resource,
  shield,
  swordMark,
  type BuiltAbility,
} from './effects';

export function baseAbilities(
  sect: CultivatorSectState,
  realm: RealmType,
): Record<string, BuiltAbility> {
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  return {
    'plain-sword': {
      config: active({
        id: 'plain-sword',
        name: '平剑式',
        mpCost: 0,
        cooldown: 0,
        role: 'generator',
        effects: [damage(0.8), resource(resourceId, 1)],
      }),
      detailRows: ['伤害：1段 × 0.80物攻', '剑势：获得1点'],
      notes: [],
    },
    'guiding-sword': {
      config: active({
        id: 'guiding-sword',
        name: '引剑式',
        mpCost: manaCost(realm, 1),
        cooldown: 0,
        role: 'generator',
        effects: [damage(0.85), resource(resourceId, 1)],
      }),
      detailRows: ['伤害：0.85物攻', '剑势：获得1点'],
      notes: [],
    },
    'linked-edge': {
      config: active({
        id: 'linked-edge',
        name: '连锋式',
        mpCost: manaCost(realm, 1.5),
        cooldown: 2,
        role: 'combo',
        effects: [
          damage(0.42),
          damage(0.42),
          damage(0.42),
          resource(resourceId, 2),
          swordMark(),
        ],
      }),
      detailRows: ['伤害：3段 × 0.42物攻', '剑势：获得2点', '剑痕：施加1层'],
      notes: [],
    },
    'turning-body': {
      config: active({
        id: 'turning-body',
        name: '回身式',
        mpCost: manaCost(realm, 1.25),
        cooldown: 3,
        role: 'defensive',
        effects: [damage(0.65)],
      }),
      detailRows: ['伤害：0.65物攻'],
      notes: [],
    },
    'breaking-edge': {
      config: active({
        id: 'breaking-edge',
        name: '破锋式',
        mpCost: manaCost(realm, 1.75),
        cooldown: 2,
        role: 'finisher',
        castConditions: [
          {
            type: 'combat_resource_at_least',
            params: { resourceId, value: 3, scope: 'caster' },
          },
        ],
        effects: [damage(1), consumeResource(resourceId)],
      }),
      detailRows: [
        '伤害：1.00物攻',
        '释放：至少3点剑势',
        '释放后：消耗全部剑势',
      ],
      notes: [],
    },
    'sword-aegis': {
      config: active({
        id: 'sword-aegis',
        name: '剑罡护体',
        mpCost: manaCost(realm, 1.5),
        cooldown: 3,
        role: 'defensive',
        targetTeam: 'self',
        effects: [shield(0.6)],
      }),
      detailRows: ['护盾：0.60物攻'],
      notes: [],
    },
    'shadow-step': {
      config: active({
        id: 'shadow-step',
        name: '踏影',
        mpCost: manaCost(realm, 1),
        cooldown: 2,
        role: 'generator',
        effects: [
          damage(0.55),
          {
            type: 'apply_buff',
            params: {
              target: 'caster',
              buffConfig: {
                id: LINGXIAO_SHADOW_STEP_BUFF,
                name: '踏影',
                type: BuffType.BUFF,
                duration: 2,
                stackRule: StackRule.REFRESH_DURATION,
                tags: [GameplayTags.BUFF.TYPE.BUFF],
                modifiers: [
                  {
                    attrType: AttributeType.SPEED,
                    type: ModifierType.ADD,
                    value: 0.1,
                  },
                ],
              },
            },
          },
        ],
      }),
      detailRows: ['伤害：0.55物攻', '身法：提高10%，持续2回合'],
      notes: [],
    },
    'sect-ultimate': {
      config: active({
        id: 'sect-ultimate',
        name: '凌霄绝式',
        mpCost: manaCost(realm, 2.5),
        cooldown: 4,
        role: 'finisher',
        effects: [damage(1.8)],
      }),
      detailRows: ['伤害：1.80物攻'],
      notes: [],
    },
    'nurturing-sword': {
      config: active({
        id: 'nurturing-sword',
        name: '养剑式',
        mpCost: manaCost(realm, 1.5),
        cooldown: 4,
        role: 'utility',
        targetTeam: 'self',
        heal: true,
        effects: [healMaxHp(0.08), shield(0.35)],
      }),
      detailRows: ['恢复：8%最大气血', '护盾：0.35物攻'],
      notes: [],
    },
  };
}

export function compileLingxiaoBase(
  context: SectProjectionContext,
): SectCompiledBuild {
  return {
    defaultAbilityId: 'plain-sword',
    abilities: baseAbilities(context.sect, context.realm),
    resources: [
      {
        id: LINGXIAO_SWORD_MOMENTUM,
        name: '剑势',
        initial: 0,
        max: 3,
        decayOnNoDirectDamage: 1,
        decayOnControlledSkip: 1,
        pauseDecayWhileShielded: true,
      },
    ],
    passives: [],
  };
}
