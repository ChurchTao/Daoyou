import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import {
  AttributeType,
  BuffType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { createLingxiaoNode } from '../../../shared/createLingxiaoNode';
import {
  LINGXIAO_SWORD_MOMENTUM,
  createSwordMark,
} from '../../../shared/LingxiaoMechanics';
import {
  addHiddenNodePassive,
  addLingxiaoPassive,
  addProbingNodePassive,
} from '../../../shared/SwordNodePassives';
import { swiftSwordBuild } from '../SwiftSwordBuildFacade';

export const SWIFT_LAYER_1_NODES = [
  createLingxiaoNode(
    {
      id: 'swift-opening',
      layer: 1,
      name: '疾起',
      description: '开场获得2点剑势，第一回合身法提高8%。',
    },
    (context, builder) => {
      swiftSwordBuild(builder).enable('opening');
      addLingxiaoPassive(context, builder, {
        id: 'swift-opening',
        name: '疾起',
        listeners: [
          {
            id: 'sect.lingxiao.swift-opening.speed',
            eventType: 'BattleInitEvent',
            scope: GameplayTags.SCOPE.GLOBAL,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            budget: { maxTriggers: 1, reset: 'battle' },
            effects: [
              {
                type: 'apply_buff',
                params: {
                  target: 'caster',
                  buffConfig: {
                    id: 'sect.lingxiao.swift-opening-speed',
                    name: '疾起',
                    type: BuffType.BUFF,
                    duration: 1,
                    stackRule: StackRule.REFRESH_DURATION,
                    tags: [GameplayTags.BUFF.TYPE.BUFF],
                    modifiers: [
                      {
                        attrType: AttributeType.SPEED,
                        type: ModifierType.ADD,
                        value: 0.08,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      });
    },
  ),
  createLingxiaoNode(
    {
      id: 'swift-hidden-edge',
      layer: 1,
      name: '藏锋',
      description: '首次受到直接伤害降低10%，并额外获得3点剑势。',
    },
    (context, builder) =>
      addHiddenNodePassive(context, builder, {
        id: 'swift-hidden-edge',
        name: '藏锋',
        resourceId: LINGXIAO_SWORD_MOMENTUM,
      }),
  ),
  createLingxiaoNode(
    {
      id: 'swift-probing-edge',
      layer: 1,
      name: '试锋',
      description: '平剑式每两次命中额外获得1点剑势并施加1层剑痕。',
    },
    (context, builder) =>
      addProbingNodePassive(context, builder, {
        id: 'swift-probing-edge',
        name: '试锋',
        resourceId: LINGXIAO_SWORD_MOMENTUM,
        basicAbilityId: 'plain-sword',
        statusEffect: createSwordMark(),
      }),
  ),
] as const;
