export const MAIN_STORY_V1_ID = 'main.v1' as const;
export const MAIN_STORY_V1_VERSION = 1 as const;

export type MainStoryStatus = 'locked' | 'active' | 'completed';

export interface MainStoryActionLink {
  label: string;
  href: string;
  hint?: string;
}

export interface MainStorySnapshot {
  storyId: typeof MAIN_STORY_V1_ID;
  version: typeof MAIN_STORY_V1_VERSION;
  volumeTitle: string;
  status: MainStoryStatus;
  lockReason?: string;
  currentNodeId: string | null;
  currentStep: string | null;
  currentTitle: string;
  progressText: string;
  summary: string;
  /** 任务中心仅用于回顾，不参与正常主线触发。 */
  action: MainStoryActionLink | null;
  /** 玩家已经亲自确认的事实，供卷宗回顾。 */
  knownFacts: string[];
  completedAt?: string | null;
  nextVolumeTitle?: string;
}

export interface MainStorySceneLine {
  speaker?: string;
  text: string;
  aside?: boolean;
}

export interface MainStoryChoice {
  id: string;
  label: string;
  hint?: string;
}

export interface MainStoryScene {
  storyId: typeof MAIN_STORY_V1_ID;
  version: typeof MAIN_STORY_V1_VERSION;
  nodeId: string;
  sceneKey: string;
  title: string;
  location: string;
  kicker?: string;
  narration: string[];
  lines: MainStorySceneLine[];
  choices: MainStoryChoice[];
}

export interface MainStoryContinuation {
  kind: 'travel' | 'await_gameplay' | 'complete';
  title: string;
  narration: string[];
  action: MainStoryActionLink | null;
  dismissLabel?: string;
}

export interface MainStorySceneQueryResult {
  story: MainStorySnapshot;
  scene: MainStoryScene | null;
}

export interface MainStoryMutationResult {
  story: MainStorySnapshot;
  scene: MainStoryScene | null;
  continuation: MainStoryContinuation | null;
  replayed?: boolean;
}

/**
 * V1.3 起：业务页面只认识稳定的“剧情插槽”，不认识卷号、节点或 Flag。
 * 新卷剧情只能扩展 Story Runtime / surface provider，不应在 auction/dungeon/sect 等目录里写 01-xx 判断。
 */
export const STORY_SURFACE_KEYS = [
  'sect.affairs',
  'sect.herb-garden',
  'sect.archive',
  'sect.gate',
  'inn.spirit-spring',
  'auction.list',
  'black-market.room',
  'market.recycle',
  'dungeon.settlement',
] as const;
export type StorySurfaceKey = (typeof STORY_SURFACE_KEYS)[number];

export interface StorySurfaceContext {
  mapNodeId?: string;
  /**
   * NPC 对话插槽只用稳定的人物显示名做匹配。
   * 业务房间不认识卷号、节点或剧情 Flag，只把当前正在交谈的人告诉 Story Runtime。
   */
  npcName?: string;
}

export interface StorySurfaceAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  hint?: string;
}

export interface StorySurfaceCinematicAct {
  id: string;
  eyebrow?: string;
  title: string;
  body: string;
}

export interface StorySurfaceBaseEntry {
  id: string;
  surface: StorySurfaceKey;
}

export interface StorySurfaceAutoEntry extends StorySurfaceBaseEntry {
  kind: 'auto';
  interactionId: string;
}

export interface StorySurfaceCardEntry extends StorySurfaceBaseEntry {
  kind: 'card';
  eyebrow?: string;
  title: string;
  body: string[];
  quote?: string;
  notice?: string;
  actions: StorySurfaceAction[];
}

export interface StorySurfaceNpcDialogueLine {
  id: string;
  text: string;
  tone?: 'normal' | 'muted' | 'attention';
  speaker?: 'actor' | 'narrator';
}

export interface StorySurfaceNpcDialogueAction {
  id: string;
  label: string;
  tone?: 'normal' | 'primary' | 'muted';
  /** 完成剧情交互后可在人物对话内部自然前往下一处；不经过全局弹窗。 */
  href?: string;
}

export interface StorySurfaceNpcDialogueEntry extends StorySurfaceBaseEntry {
  kind: 'npc-dialogue';
  npcName: string;
  topicLabel: string;
  topicTone?: 'normal' | 'primary' | 'muted';
  messages: StorySurfaceNpcDialogueLine[];
  actions: StorySurfaceNpcDialogueAction[];
}

export interface StorySurfaceInvestigationTarget {
  id: string;
  label: string;
  result: string;
  cinematic?: {
    title: string;
    visual: 'root' | 'moon' | 'voice';
    acts: StorySurfaceCinematicAct[];
  };
}

export interface StorySurfaceInvestigationEntry extends StorySurfaceBaseEntry {
  kind: 'investigation';
  eyebrow?: string;
  title: string;
  intro: string;
  targets: StorySurfaceInvestigationTarget[];
  requiredTargetIds: string[];
  afterRequired?: string[];
  quote?: string;
  actions: StorySurfaceAction[];
}

export interface StorySurfaceCinematicEntry extends StorySurfaceBaseEntry {
  kind: 'cinematic';
  eyebrow?: string;
  title: string;
  intro: string;
  buttonLabel: string;
  visual: 'root' | 'moon' | 'voice';
  acts: StorySurfaceCinematicAct[];
  finalInteractionId: string;
  finalLabel?: string;
}

export interface StorySurfaceLampLedgerEntry extends StorySurfaceBaseEntry {
  kind: 'lamp-ledger';
  eyebrow?: string;
  title: string;
  ledgerNames: string[];
  lampCount: number;
  interactionId: string;
}

export interface StorySurfaceGateLedgerRow {
  time: string;
  name: string;
  origin: string;
  destination: string;
}

export interface StorySurfaceGateLedgerEntry extends StorySurfaceBaseEntry {
  kind: 'gate-ledger';
  eyebrow?: string;
  title: string;
  rows: StorySurfaceGateLedgerRow[];
  actions: StorySurfaceAction[];
}

export interface StorySurfaceMarketAppraisalEntry extends StorySurfaceBaseEntry {
  kind: 'market-appraisal';
  eyebrow?: string;
  title: string;
  objectName: string;
  attempts: string[];
  conclusion: string;
  quote: string;
  interactionId: string;
}

export interface StorySurfaceDungeonDiscoveryEntry extends StorySurfaceBaseEntry {
  kind: 'dungeon-discovery';
  mode: 'discover' | 'route';
  eyebrow?: string;
  title: string;
  intro?: string;
  interactionId?: string;
  actions?: StorySurfaceAction[];
}

export interface StoryAuctionVirtualListing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: 'material';
  itemId: string;
  itemName: string;
  itemQuality: '凡品';
  itemCategory: 'ore';
  itemSnapshot: {
    id: string;
    name: string;
    type: 'ore';
    rank: '凡品';
    quantity: number;
    description: string;
    details?: Record<string, unknown>;
  };
  price: number;
  initialQuantity: number;
  remainingQuantity: number;
  visibility: 'public';
  status: 'active';
  createdAt: string;
  expiresAt: string;
}

export interface StorySurfaceAuctionListingEntry extends StorySurfaceBaseEntry {
  kind: 'auction-listing';
  listing: StoryAuctionVirtualListing;
  detailInteractionId: string;
  cancelInteractionId: string;
  metaLabel: string;
  timeLabel: string;
}

export interface StorySurfaceBlackMarketEntry extends StorySurfaceBaseEntry {
  kind: 'black-market-encounter';
  npcId: 'urgent-cultivator' | 'silent-elder';
  statusLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  objectName?: string;
  objectDescription?: string;
  probes?: Array<{ id: string; label: string; dialogue: string[] }>;
  interjection?: string[];
  actions: StorySurfaceAction[];
}

export type StorySurfaceEntry =
  | StorySurfaceAutoEntry
  | StorySurfaceCardEntry
  | StorySurfaceNpcDialogueEntry
  | StorySurfaceInvestigationEntry
  | StorySurfaceCinematicEntry
  | StorySurfaceLampLedgerEntry
  | StorySurfaceGateLedgerEntry
  | StorySurfaceMarketAppraisalEntry
  | StorySurfaceDungeonDiscoveryEntry
  | StorySurfaceAuctionListingEntry
  | StorySurfaceBlackMarketEntry;

export interface StorySurfaceResult {
  story: MainStorySnapshot;
  surface: StorySurfaceKey;
  entries: StorySurfaceEntry[];
}

export interface StorySurfaceInteractionResult extends MainStoryMutationResult {
  consumedInteractionId: string;
}

/**
 * 兼容 V1.2 的同步交互 API。V1.3 以后业务页面不得直接发送这些事件；
 * 只能由 StorySurface interaction、全局 CG host 或兼容迁移代码使用。
 */
export type MainStoryRuntimeEventType =
  | 'dungeon_settlement'
  | 'dungeon_blank_page_collected'
  | 'breakthrough_success'
  | 'v1_affairs_observed'
  | 'v1_herb_normal_observed'
  | 'v1_gate_normal_observed'
  | 'v1_root_investigated'
  | 'v1_archive_root_discussed'
  | 'v1_spring_moon_observed'
  | 'v1_auction_future_listing_opened'
  | 'v1_auction_future_listing_resolved'
  | 'v1_black_market_fragment_resolved'
  | 'v1_lamp_mismatch_verified'
  | 'v1_blank_page_route_selected'
  | 'v1_blank_page_elder_checked'
  | 'v1_blank_page_market_checked'
  | 'v1_archive_letters_handled'
  | 'v1_gate_ledger_resolved'
  | 'v1_pre_breakthrough_ready'
  | 'v1_voice_heard'
  | 'v1_archive_voice_reported';
