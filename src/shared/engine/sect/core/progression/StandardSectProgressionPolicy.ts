import { EXP_CAP_TABLE } from '@shared/config/cultivationProgress';
import { getRealmStageRank } from '@shared/config/realmProgression';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import type {
  SectMethodId,
  SectPathDefinition,
  SectPathLayerDefinition,
  SectTrainingCost,
} from '../domain';

export interface SectPathProgressProjection {
  unlockedLayers: SectPathLayerDefinition[];
  nextLayer: SectPathLayerDefinition | null;
  nextLayerAvailable: boolean;
  missingRequirements: string[];
}

export interface SectProgressionPolicy {
  methodLevelCap(realm: RealmType, stage: RealmStage): number;
  minimumRealmStageForMethodLevel(level: number): {
    realm: RealmType;
    stage: RealmStage;
  };
  methodTrainingCost(fromLevel: number, targetLevel: number): SectTrainingCost;
  pathProgress(args: {
    path: SectPathDefinition;
    unlockedLayerIds: string[];
    realm: RealmType;
    stage: RealmStage;
    methods: Partial<Record<SectMethodId, number>>;
  }): SectPathProgressProjection;
  assertPathLayerUnlock(args: {
    path: SectPathDefinition;
    unlockedLayerIds: string[];
    layerId: string;
    realm: RealmType;
    stage: RealmStage;
    methods: Partial<Record<SectMethodId, number>>;
  }): SectPathLayerDefinition;
}

function pathLayerCost(
  realm: RealmType,
  stage: RealmStage,
  comprehensionInsight: number,
): SectTrainingCost {
  const cultivationExp = Math.ceil(EXP_CAP_TABLE[realm][stage] * 0.5);
  return {
    cultivationExp,
    comprehensionInsight,
    spiritStones: cultivationExp * 10,
  };
}

export const STANDARD_PATH_LAYERS: readonly SectPathLayerDefinition[] = [
  {
    id: '1',
    order: 1,
    label: '第一层',
    minRealm: '筑基',
    minRealmStage: '初期',
    cost: pathLayerCost('筑基', '初期', 10),
  },
  {
    id: '2',
    order: 2,
    label: '第二层',
    minRealm: '筑基',
    minRealmStage: '圆满',
    cost: pathLayerCost('筑基', '圆满', 15),
  },
  {
    id: '3',
    order: 3,
    label: '第三层',
    minRealm: '金丹',
    minRealmStage: '圆满',
    cost: pathLayerCost('金丹', '圆满', 20),
  },
  {
    id: '4',
    order: 4,
    label: '第四层',
    minRealm: '元婴',
    minRealmStage: '圆满',
    cost: pathLayerCost('元婴', '圆满', 25),
  },
  {
    id: '5',
    order: 5,
    label: '第五层',
    minRealm: '化神',
    minRealmStage: '中期',
    cost: pathLayerCost('化神', '中期', 30),
  },
  {
    id: 'ultimate',
    order: 6,
    label: '终式',
    minRealm: '化神',
    minRealmStage: '圆满',
    cost: pathLayerCost('化神', '圆满', 40),
  },
] as const;

function sortedLayers(path: SectPathDefinition): SectPathLayerDefinition[] {
  return [...path.layers].sort((left, right) => left.order - right.order);
}

function missingLayerRequirements(args: {
  layer: SectPathLayerDefinition;
  realm: RealmType;
  stage: RealmStage;
  methods: Partial<Record<SectMethodId, number>>;
}): string[] {
  const missing: string[] = [];
  if (
    args.layer.minRealm &&
    args.layer.minRealmStage &&
    getRealmStageRank(args.realm, args.stage) <
      getRealmStageRank(args.layer.minRealm, args.layer.minRealmStage)
  ) {
    missing.push(`${args.layer.minRealm}${args.layer.minRealmStage}`);
  }
  for (const [methodId, level] of Object.entries(
    args.layer.requiredMethods ?? {},
  )) {
    if ((args.methods[methodId] ?? 0) < level) {
      missing.push(`心法 ${methodId} ${level}级`);
    }
  }
  return missing;
}

/** 通用宗门成长策略；具体流派只声明层定义，不参与流程分派。 */
export class StandardSectProgressionPolicy implements SectProgressionPolicy {
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

  methodTrainingCost(fromLevel: number, targetLevel: number): SectTrainingCost {
    const total: SectTrainingCost = {
      cultivationExp: 0,
      comprehensionInsight: 0,
      spiritStones: 0,
    };
    for (let level = fromLevel + 1; level <= targetLevel; level += 1) {
      const { realm, stage } = this.minimumRealmStageForMethodLevel(level);
      const cultivationExp = Math.ceil(EXP_CAP_TABLE[realm][stage] * 0.01);
      total.cultivationExp += cultivationExp;
      total.spiritStones += Math.max(50, cultivationExp * 2);
    }
    return total;
  }

  pathProgress(args: {
    path: SectPathDefinition;
    unlockedLayerIds: string[];
    realm: RealmType;
    stage: RealmStage;
    methods: Partial<Record<SectMethodId, number>>;
  }): SectPathProgressProjection {
    const unlocked = new Set(args.unlockedLayerIds);
    const layers = sortedLayers(args.path);
    const nextLayer = layers.find((layer) => !unlocked.has(layer.id)) ?? null;
    const missingRequirements = nextLayer
      ? missingLayerRequirements({ ...args, layer: nextLayer })
      : [];
    return {
      unlockedLayers: layers.filter((layer) => unlocked.has(layer.id)),
      nextLayer,
      nextLayerAvailable:
        Boolean(nextLayer) && missingRequirements.length === 0,
      missingRequirements,
    };
  }

  assertPathLayerUnlock(args: {
    path: SectPathDefinition;
    unlockedLayerIds: string[];
    layerId: string;
    realm: RealmType;
    stage: RealmStage;
    methods: Partial<Record<SectMethodId, number>>;
  }): SectPathLayerDefinition {
    const progress = this.pathProgress(args);
    const requested = args.path.layers.find(
      (layer) => layer.id === args.layerId,
    );
    if (!requested) throw new Error('未知流派层级');
    if (args.unlockedLayerIds.includes(args.layerId))
      throw new Error(`${requested.label}已经解锁`);
    if (progress.nextLayer?.id !== args.layerId)
      throw new Error('流派层级必须按顺序解锁');
    if (!progress.nextLayerAvailable)
      throw new Error(`尚需：${progress.missingRequirements.join('、')}`);
    return requested;
  }
}

export const standardSectProgression = new StandardSectProgressionPolicy();
