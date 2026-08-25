import type {
  DungeonStoryContext,
  StoryAftermathGeneration,
  StoryAftermathNarratorMode,
  StoryChoiceKey,
  StoryDungeonBlueprint,
  StoryEntityLifeStatus,
  StoryMemoryGeneration,
  StoryOmenGeneration,
  StoryThreadScope,
} from '@shared/lib/story/personalStory';
import type {
  TravelStoryGeneration,
  TravelStoryIntentPayload,
  TravelStoryLinkKind,
} from '@shared/lib/story/travelStory';
import type { RealmStage, RealmType } from '@shared/types/constants';

export interface StoryDungeonTriggerContext {
  cultivator: {
    id: string;
    name: string;
    realm: string;
    realmStage: string;
    personality?: string | null;
    background?: string | null;
  };
  run: {
    id: string;
    mapNodeId: string;
    theme: string;
    outcome: 'completed' | 'retreated_after_battle' | 'abandoned_before_battle';
    history: Array<{
      round: number;
      scene: string;
      choice?: string;
      outcome?: string;
      gainedItems?: string[];
    }>;
    endingNarrative?: string;
    defeatedEnemyNames: string[];
    accumulatedRewards: Array<{
      name?: string;
      description?: string;
    }>;
    storyContext?: DungeonStoryContext;
  };
  occurredAt: string;
}

export interface StoryMemoryReference {
  id: string;
  summary: string;
  tags: string[];
  importance: number;
  entityIds: string[];
  evidence: Record<string, unknown>;
}

export interface StoryRelatedEntityReference {
  id: string;
  name: string;
  state: string;
  relationship: string;
  lifeStatus: StoryEntityLifeStatus;
}

export interface StoryThreadGenerationContext {
  id: string;
  threadScope: StoryThreadScope;
  premise: string;
  unresolvedQuestion: string;
  selectedChoiceKey?: StoryChoiceKey;
  entity?: {
    id: string;
    name: string;
    state: string;
    relationship: string;
    lifeStatus: StoryEntityLifeStatus;
  };
}

export interface StoryAftermathPolicy {
  entityDefeated: boolean;
  lifeStatus: StoryEntityLifeStatus;
  narratorMode: StoryAftermathNarratorMode;
  resolutionStatus: 'resolved' | 'partial' | 'failed';
}

export type StoryGenerationResult<T> = {
  output: T;
  source: 'llm' | 'fallback';
  error?: string;
};

export type StoryMemoryGenerationResult =
  StoryGenerationResult<StoryMemoryGeneration>;
export type StoryOmenGenerationResult =
  StoryGenerationResult<StoryOmenGeneration>;
export type StoryBlueprintGenerationResult =
  StoryGenerationResult<StoryDungeonBlueprint>;
export type StoryAftermathGenerationResult =
  StoryGenerationResult<StoryAftermathGeneration>;

export interface TravelStoryTriggerContext {
  cultivator: {
    id: string;
    name: string;
    realm: RealmType;
    realmStage: RealmStage;
    personality?: string | null;
    background?: string | null;
  };
  journey: TravelStoryIntentPayload['source'];
  occurredAt: string;
}

export interface TravelStoryGenerationLinkageContext {
  kind: TravelStoryLinkKind;
  thread: StoryThreadGenerationContext;
  authoritativeSummary: string;
  nextHook?: string;
}

export type TravelStoryGenerationResult =
  StoryGenerationResult<TravelStoryGeneration>;
