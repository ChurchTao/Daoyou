import type { NarrativePerformanceScript } from '../narrative.js';
import type { SectCapabilityKey } from './organization-contracts.js';

export type SectSceneKey =
  | 'map'
  | 'hall'
  | 'affairs'
  | 'archive'
  | 'paths'
  | 'arena'
  | 'treasury'
  | 'industries'
  | 'cultivation'
  | 'alchemy'
  | 'refinery'
  | 'spiritVein'
  | 'herbGarden'
  | 'gate'
  | 'cave'
  | 'taskBattle';

export interface SectMapHotspot {
  id: string;
  label: string;
  route?: string;
  facility?: string;
  permission?: SectCapabilityKey;
  left: string;
  top: string;
  note: string;
  locked?: boolean;
  visitor?: {
    description: string;
  };
}

export interface SectScenePresentation {
  title: string;
  description: string;
  loadingText: string;
  permissionDeniedDescription: string;
}

export type SectAffairsTaskKind = 'daily' | 'weekly' | 'promotion';

export type SectRoomActorAppearance = 'person' | 'facility';

export interface SectRoomNpcPresentation {
  id: string;
  sigil: string;
  name: string;
  identity: string;
  responsibility: string;
  greeting: string;
  appearance: SectRoomActorAppearance;
}

export interface SectRoomConversationDefinition {
  renderer: string;
  parameters?: Readonly<Record<string, unknown>>;
}

export interface SectRoomActorDefinition extends SectRoomNpcPresentation {
  roleKey: string;
  conversation: SectRoomConversationDefinition;
}

export interface SectRoomDefinition {
  key: string;
  description: string;
  actors: readonly SectRoomActorDefinition[];
}

export interface SectRoomThemeOverride {
  description?: string;
  actors?: Readonly<
    Record<
      string,
      Partial<Pick<SectRoomActorDefinition, 'id' | 'name' | 'greeting'>>
    >
  >;
}

export interface SectPresentationTerms {
  pathChanges: string;
  meridianPractice: string;
  meridianLoadout: string;
  abilityChanges: string;
  returnToAffairs: string;
  sweepActivity: string;
  sweepCanvasLabel: string;
}

export interface SectPresentationTheme {
  sectId: string;
  announcement: string;
  onboarding?: {
    summary: string;
    traits: readonly [string, string, string];
    script: NarrativePerformanceScript;
  };
  map?: {
    image?: string;
    alt?: string;
    aspectRatio?: number;
    hotspots?: readonly SectMapHotspot[];
  };
  facilityLabels?: Readonly<Record<string, string>>;
  lockedFacilities?: readonly string[];
  scenes?: Partial<Record<SectSceneKey, Partial<SectScenePresentation>>>;
  rooms?: Readonly<Record<string, SectRoomThemeOverride>>;
  terms?: Partial<
    Omit<SectPresentationTerms, 'sweepActivity' | 'sweepCanvasLabel'>
  >;
}

export interface ResolvedSectPresentation {
  sectId: string;
  announcement: string;
  onboarding?: SectPresentationTheme['onboarding'];
  map: {
    image?: string;
    alt: string;
    aspectRatio: number;
    hotspots: readonly SectMapHotspot[];
  };
  facilityLabels: Readonly<Record<string, string>>;
  lockedFacilities: readonly string[];
  scenes: Readonly<Record<SectSceneKey, SectScenePresentation>>;
  rooms: Readonly<Record<string, SectRoomDefinition>>;
  terms: Readonly<SectPresentationTerms>;
}
