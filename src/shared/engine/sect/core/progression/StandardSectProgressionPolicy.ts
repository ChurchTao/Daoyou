import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import type { SectMeridianLayer, SectMeridianNodeDefinition } from '../domain';

export const STANDARD_MERIDIAN_STAGES = [
  {
    layer: 1 as const,
    label: '第一层',
    realm: '筑基' as const,
    stage: '初期' as const,
    pathLevel: 5,
  },
  {
    layer: 2 as const,
    label: '第二层',
    realm: '筑基' as const,
    stage: '圆满' as const,
    pathLevel: 15,
  },
  {
    layer: 3 as const,
    label: '第三层',
    realm: '金丹' as const,
    stage: '圆满' as const,
    pathLevel: 30,
  },
  {
    layer: 4 as const,
    label: '第四层',
    realm: '元婴' as const,
    stage: '圆满' as const,
    pathLevel: 50,
  },
  {
    layer: 5 as const,
    label: '第五层',
    realm: '化神' as const,
    stage: '中期' as const,
    pathLevel: 70,
  },
  {
    layer: 'ultimate' as const,
    label: '终式',
    realm: '化神' as const,
    stage: '圆满' as const,
    pathLevel: 100,
  },
] as const;

/** 所有宗门共用的心法、流派和六层经脉成长策略。 */
export class StandardSectProgressionPolicy {
  methodLevelCap(realm: RealmType, stage: RealmStage): number {
    return (getRealmStageRank(realm, stage) + 1) * 5;
  }

  minimumRealmStageForMethodLevel(level: number): {
    realm: RealmType;
    stage: RealmStage;
  } {
    for (const realm of REALM_VALUES) {
      for (const stage of REALM_STAGE_VALUES) {
        if (this.methodLevelCap(realm, stage) >= level) return { realm, stage };
      }
    }
    return { realm: '渡劫', stage: '圆满' };
  }

  trainingCost(
    fromLevel: number,
    targetLevel: number,
  ): {
    contribution: number;
    spiritStones: number;
  } {
    let contribution = 0;
    let spiritStones = 0;
    for (let level = fromLevel + 1; level <= targetLevel; level += 1) {
      contribution += 1 + Math.floor((level - 1) / 30);
      spiritStones += 50 * (1 + Math.floor((level - 1) / 20));
    }
    return { contribution, spiritStones };
  }

  requirementsForLayer(layer: SectMeridianLayer) {
    const stage = STANDARD_MERIDIAN_STAGES.find(
      (entry) => entry.layer === layer,
    );
    if (!stage) throw new Error(`未知经脉层级: ${String(layer)}`);
    return {
      minRealm: stage.realm,
      minRealmStage: stage.stage,
      minPathLevel: stage.pathLevel,
    };
  }

  defineNode(
    definition: Omit<
      SectMeridianNodeDefinition,
      'minRealm' | 'minRealmStage' | 'minPathLevel'
    >,
  ): SectMeridianNodeDefinition {
    return {
      ...definition,
      ...this.requirementsForLayer(definition.layer),
    };
  }
}

export const standardSectProgression = new StandardSectProgressionPolicy();
