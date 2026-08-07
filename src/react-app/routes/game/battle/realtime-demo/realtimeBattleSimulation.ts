import {
  projectCombatVisualAction,
  type CombatControlVisual,
  type CombatVisualActionInput,
  type CombatVisualFact,
  type CombatVisualTimeline,
} from '@shared/engine/battle-v5/presentation';
import { resolveRealtimeBattleVisualSpec } from './realtimeBattleVisualRegistry';

export type RealtimeBattleTeam = 'allies' | 'enemies';

export interface RealtimeBattleEffect {
  id: string;
  label: string;
  tone: 'buff' | 'debuff';
  statusType: 'buff' | 'debuff' | 'control';
  controlVisual?: CombatControlVisual;
  layers: number;
  until: number;
}

export interface RealtimeBattleResource {
  id: string;
  name: string;
  icon: string;
  iconHueRotation?: number;
  current: number;
  max: number;
}

export interface RealtimeBattleActionState {
  id: string;
  label: string;
  tone: 'preparing' | 'control' | 'mode';
  until: number;
}

export type RealtimeBattleCommand =
  'split-light' | 'moon-step' | 'hold-origin' | 'fox-hunt';

export interface RealtimeBattleEntity {
  id: string;
  name: string;
  team: RealtimeBattleTeam;
  kind: 'cultivator' | 'spirit-pet';
  ownerId?: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  qi: number;
  maxQi: number;
  shield: number;
  alive: boolean;
  effects: RealtimeBattleEffect[];
  combatResources: RealtimeBattleResource[];
  actionStates: RealtimeBattleActionState[];
}

export interface RealtimeBattleSnapshot {
  elapsedMs: number;
  cycle: number;
  phase: string;
  focusedEntityId: string;
  latestAction?: CombatVisualActionInput;
  entities: RealtimeBattleEntity[];
}

type RealtimeBattleFactDraft = CombatVisualFact extends infer T
  ? T extends CombatVisualFact
    ? Omit<T, 'id'>
    : never
  : never;

interface RealtimeBattleActionDraft {
  sourceId: string;
  targetIds: string[];
  ability: { id: string; name: string };
  annotation: string;
  facts: RealtimeBattleFactDraft[];
}

interface ScriptedAction {
  at: number;
  action: RealtimeBattleActionDraft;
}

interface PendingResolution {
  at: number;
  actionId: string;
  fact: CombatVisualFact;
}

const SCRIPT_TIME_SCALE = 1.22;

export const REALTIME_BATTLE_LOOP_DURATION_MS = 70_000;

const INITIAL_ENTITIES: Array<
  Omit<
    RealtimeBattleEntity,
    'alive' | 'effects' | 'combatResources' | 'actionStates'
  > & { combatResources?: RealtimeBattleResource[] }
> = [
  {
    id: 'xie-wujiu',
    name: '谢无咎',
    team: 'allies',
    kind: 'cultivator',
    x: 0.27,
    y: 0.5,
    hp: 760,
    maxHp: 900,
    qi: 438,
    maxQi: 600,
    shield: 0,
    combatResources: [
      {
        id: 'sword-intent',
        name: '剑意',
        icon: '🗡️',
        current: 1,
        max: 6,
      },
    ],
  },
  {
    id: 'qing-li',
    name: '青璃',
    team: 'allies',
    kind: 'cultivator',
    x: 0.16,
    y: 0.27,
    hp: 624,
    maxHp: 720,
    qi: 532,
    maxQi: 640,
    shield: 0,
  },
  {
    id: 'mist-deer',
    name: '霁月鹿',
    team: 'allies',
    kind: 'spirit-pet',
    ownerId: 'qing-li',
    x: 0.2,
    y: 0.34,
    hp: 342,
    maxHp: 380,
    qi: 196,
    maxQi: 240,
    shield: 0,
  },
  {
    id: 'lu-xingzhou',
    name: '陆行舟',
    team: 'allies',
    kind: 'cultivator',
    x: 0.16,
    y: 0.73,
    hp: 1080,
    maxHp: 1200,
    qi: 226,
    maxQi: 400,
    shield: 0,
    combatResources: [
      {
        id: 'war-intent',
        name: '心念',
        icon: '👹',
        current: 2,
        max: 6,
      },
    ],
  },
  {
    id: 'spirit-fox',
    name: '青尾灵狐',
    team: 'allies',
    kind: 'spirit-pet',
    ownerId: 'xie-wujiu',
    x: 0.37,
    y: 0.67,
    hp: 318,
    maxHp: 360,
    qi: 164,
    maxQi: 220,
    shield: 0,
  },
  {
    id: 'stone-ape',
    name: '搬山猿',
    team: 'allies',
    kind: 'spirit-pet',
    ownerId: 'lu-xingzhou',
    x: 0.28,
    y: 0.74,
    hp: 410,
    maxHp: 460,
    qi: 118,
    maxQi: 180,
    shield: 0,
  },
  {
    id: 'shen-yanqiu',
    name: '沈砚秋',
    team: 'enemies',
    kind: 'cultivator',
    x: 0.73,
    y: 0.5,
    hp: 812,
    maxHp: 900,
    qi: 476,
    maxQi: 600,
    shield: 0,
    combatResources: [
      {
        id: 'derivation',
        name: '衍数',
        icon: '✨',
        iconHueRotation: 220,
        current: 1,
        max: 3,
      },
    ],
  },
  {
    id: 'frost-moth',
    name: '玄霜蛾',
    team: 'enemies',
    kind: 'spirit-pet',
    ownerId: 'shen-yanqiu',
    x: 0.68,
    y: 0.42,
    hp: 304,
    maxHp: 350,
    qi: 214,
    maxQi: 260,
    shield: 0,
  },
  {
    id: 'sikong-ye',
    name: '司空夜',
    team: 'enemies',
    kind: 'cultivator',
    x: 0.84,
    y: 0.27,
    hp: 548,
    maxHp: 680,
    qi: 590,
    maxQi: 700,
    shield: 0,
    combatResources: [
      {
        id: 'soul-fire',
        name: '魂火',
        icon: '🔥',
        iconHueRotation: 180,
        current: 0,
        max: 3,
      },
    ],
  },
  {
    id: 'gu-tingchuan',
    name: '顾停川',
    team: 'enemies',
    kind: 'cultivator',
    x: 0.84,
    y: 0.73,
    hp: 924,
    maxHp: 1040,
    qi: 282,
    maxQi: 460,
    shield: 0,
  },
  {
    id: 'ember-crow',
    name: '赤羽鸦',
    team: 'enemies',
    kind: 'spirit-pet',
    ownerId: 'sikong-ye',
    x: 0.63,
    y: 0.33,
    hp: 286,
    maxHp: 330,
    qi: 188,
    maxQi: 240,
    shield: 0,
  },
  {
    id: 'iron-tortoise',
    name: '玄甲龟',
    team: 'enemies',
    kind: 'spirit-pet',
    ownerId: 'gu-tingchuan',
    x: 0.76,
    y: 0.7,
    hp: 436,
    maxHp: 500,
    qi: 96,
    maxQi: 160,
    shield: 0,
  },
];

const SCRIPT: ScriptedAction[] = (
  [
    {
      at: 1_200,
      action: {
        sourceId: 'sikong-ye',
        targetIds: ['qing-li'],
        ability: { id: 'binding-script', name: '缚字禁' },
        annotation: '神识相拒',
        facts: [
          {
            kind: 'defense',
            targetIds: ['qing-li'],
            defense: 'resist',
            detail: '控制抵抗',
            label: '神识相拒',
          },
        ],
      },
    },
    {
      at: 4_600,
      action: {
        sourceId: 'xie-wujiu',
        targetIds: ['shen-yanqiu'],
        ability: { id: 'split-light', name: '分光剑诀' },
        annotation: '会心 · 剑意渐盛',
        facts: [
          {
            kind: 'damage',
            targetIds: ['shen-yanqiu'],
            amount: 106,
            damageType: 'physical',
            critical: true,
          },
          {
            kind: 'resource',
            sourceId: 'xie-wujiu',
            targetIds: ['xie-wujiu'],
            resourceId: 'sword-intent',
            resourceName: '剑意',
            before: 1,
            after: 2,
            max: 6,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 8_200,
      action: {
        sourceId: 'qing-li',
        targetIds: ['xie-wujiu', 'qing-li', 'lu-xingzhou'],
        ability: { id: 'lotus-ward', name: '青莲护界' },
        annotation: '结阵 · 三人受护',
        facts: [
          {
            kind: 'shield',
            targetIds: ['xie-wujiu', 'qing-li', 'lu-xingzhou'],
            operation: 'gain',
            amount: 72,
          },
          {
            kind: 'status',
            targetIds: ['xie-wujiu', 'qing-li', 'lu-xingzhou'],
            operation: 'apply',
            statusId: 'lotus-ward',
            statusName: '护界',
            statusType: 'buff',
            layers: 1,
            durationMs: 8_000,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 11_700,
      action: {
        sourceId: 'ember-crow',
        targetIds: ['xie-wujiu'],
        ability: { id: 'crow-fire', name: '啼火' },
        annotation: '破盾 · 留下灼痕',
        facts: [
          {
            kind: 'damage',
            targetIds: ['xie-wujiu'],
            amount: 98,
            damageType: 'magical',
            shieldAbsorbed: 72,
          },
          {
            kind: 'shield',
            targetIds: ['xie-wujiu'],
            operation: 'break',
            amount: 72,
            timing: 'after',
          },
          {
            kind: 'status',
            targetIds: ['xie-wujiu'],
            operation: 'apply',
            statusId: 'burn',
            statusName: '灼痕',
            statusType: 'debuff',
            layers: 1,
            durationMs: 7_000,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 15_200,
      action: {
        sourceId: 'spirit-fox',
        targetIds: ['xie-wujiu'],
        ability: { id: 'dew-return', name: '衔露回春' },
        annotation: '气血与灵力回流 · 净去灼痕',
        facts: [
          {
            kind: 'recovery',
            targetIds: ['xie-wujiu'],
            resource: 'hp',
            amount: 58,
          },
          {
            kind: 'recovery',
            targetIds: ['xie-wujiu'],
            resource: 'mp',
            amount: 36,
          },
          {
            kind: 'status',
            targetIds: ['xie-wujiu'],
            operation: 'remove',
            statusId: 'burn',
            statusName: '灼痕',
            statusType: 'debuff',
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 18_700,
      action: {
        sourceId: 'shen-yanqiu',
        targetIds: ['xie-wujiu', 'qing-li', 'lu-xingzhou'],
        ability: { id: 'cold-tide-domain', name: '寒潮剑域' },
        annotation: '范围术式 · 三人受压',
        facts: [
          {
            kind: 'damage',
            targetIds: ['xie-wujiu', 'qing-li', 'lu-xingzhou'],
            amount: 44,
            damageType: 'magical',
          },
          {
            kind: 'status',
            targetIds: ['xie-wujiu', 'qing-li', 'lu-xingzhou'],
            operation: 'apply',
            statusId: 'chilled',
            statusName: '寒滞',
            statusType: 'debuff',
            layers: 1,
            durationMs: 6_500,
            timing: 'after',
          },
          {
            kind: 'resource',
            sourceId: 'shen-yanqiu',
            targetIds: ['shen-yanqiu'],
            resourceId: 'derivation',
            resourceName: '衍数',
            before: 1,
            after: 2,
            max: 3,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 22_300,
      action: {
        sourceId: 'sikong-ye',
        targetIds: ['xie-wujiu'],
        ability: { id: 'heart-curse', name: '蚀心咒' },
        annotation: '焚元 · 心神受扰',
        facts: [
          {
            kind: 'mechanic',
            targetIds: ['xie-wujiu'],
            mechanic: 'mana_burn',
            displayName: '焚元',
            amount: 64,
          },
          {
            kind: 'damage',
            targetIds: ['xie-wujiu'],
            amount: 52,
            damageType: 'true',
          },
          {
            kind: 'status',
            targetIds: ['xie-wujiu'],
            operation: 'apply',
            statusId: 'soul-disturbed',
            statusName: '心神受扰',
            statusType: 'control',
            controlVisual: 'stun',
            layers: 1,
            durationMs: 5_500,
            timing: 'after',
          },
          {
            kind: 'resource',
            sourceId: 'sikong-ye',
            targetIds: ['sikong-ye'],
            resourceId: 'soul-fire',
            resourceName: '魂火',
            before: 0,
            after: 1,
            max: 3,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 25_900,
      action: {
        sourceId: 'gu-tingchuan',
        targetIds: ['qing-li'],
        ability: { id: 'moon-step', name: '断潮步' },
        annotation: '身法相错 · 攻势落空',
        facts: [
          {
            kind: 'defense',
            targetIds: ['qing-li'],
            defense: 'dodge',
            detail: '身法闪避',
          },
        ],
      },
    },
    {
      at: 29_200,
      action: {
        sourceId: 'lu-xingzhou',
        targetIds: ['lu-xingzhou'],
        ability: { id: 'gather-tide', name: '撼山蓄势' },
        annotation: '后发 · 下一次行动触发',
        facts: [
          {
            kind: 'action_state',
            targetIds: ['lu-xingzhou'],
            stateType: 'queued_action',
            phase: 'entered',
            stateName: '蓄势',
            durationMs: 7_000,
          },
          {
            kind: 'resource',
            targetIds: ['lu-xingzhou'],
            resourceId: 'war-intent',
            resourceName: '心念',
            before: 2,
            after: 3,
            max: 6,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 32_700,
      action: {
        sourceId: 'lu-xingzhou',
        targetIds: ['gu-tingchuan'],
        ability: { id: 'mountain-breaker', name: '撼山靠' },
        annotation: '蓄势触发 · 破盾重击',
        facts: [
          {
            kind: 'action_state',
            targetIds: ['lu-xingzhou'],
            stateType: 'queued_action',
            phase: 'triggered',
            stateName: '蓄势',
            timing: 'cast',
          },
          {
            kind: 'shield',
            targetIds: ['gu-tingchuan'],
            operation: 'break',
            amount: 60,
          },
          {
            kind: 'damage',
            targetIds: ['gu-tingchuan'],
            amount: 126,
            damageType: 'physical',
            critical: true,
          },
        ],
      },
    },
    {
      at: 36_200,
      action: {
        sourceId: 'gu-tingchuan',
        targetIds: ['gu-tingchuan'],
        ability: { id: 'mirror-armor', name: '玄甲返照' },
        annotation: '立盾 · 反震待发',
        facts: [
          {
            kind: 'shield',
            targetIds: ['gu-tingchuan'],
            operation: 'gain',
            amount: 84,
          },
          {
            kind: 'status',
            targetIds: ['gu-tingchuan'],
            operation: 'apply',
            statusId: 'reflect-armor',
            statusName: '返照',
            statusType: 'buff',
            layers: 1,
            durationMs: 6_500,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 39_600,
      action: {
        sourceId: 'xie-wujiu',
        targetIds: ['gu-tingchuan'],
        ability: { id: 'split-light', name: '剑字回锋' },
        annotation: '护盾承伤 · 玄甲反震',
        facts: [
          {
            kind: 'damage',
            targetIds: ['gu-tingchuan'],
            amount: 94,
            damageType: 'physical',
            shieldAbsorbed: 84,
          },
          {
            kind: 'damage',
            sourceId: 'gu-tingchuan',
            targetIds: ['xie-wujiu'],
            amount: 28,
            damageType: 'physical',
            damageSource: 'reflect',
            timing: 'after',
            reaction: { sourceId: 'gu-tingchuan', label: '玄甲反震' },
          },
        ],
      },
    },
    {
      at: 43_000,
      action: {
        sourceId: 'sikong-ye',
        targetIds: ['xie-wujiu'],
        ability: { id: 'memory-release', name: '照魂返响' },
        annotation: '释出旧痕 · 延迟伤害',
        facts: [
          {
            kind: 'mechanic',
            targetIds: ['sikong-ye'],
            mechanic: 'memory_release',
            displayName: '释痕',
            amount: 96,
            timing: 'cast',
          },
          {
            kind: 'damage',
            targetIds: ['xie-wujiu'],
            amount: 96,
            damageType: 'true',
            damageSource: 'delayed',
            reaction: { sourceId: 'sikong-ye', label: '旧痕返响' },
          },
          {
            kind: 'mechanic',
            targetIds: ['xie-wujiu'],
            mechanic: 'damage_defer',
            displayName: '缓劫',
            amount: 48,
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 46_500,
      action: {
        sourceId: 'sikong-ye',
        targetIds: ['xie-wujiu'],
        ability: { id: 'deferred-doom', name: '缓劫临身' },
        annotation: '递延伤害爆发 · 护命触发',
        facts: [
          {
            kind: 'damage',
            targetIds: ['xie-wujiu'],
            amount: 168,
            damageType: 'true',
            damageSource: 'delayed',
          },
          {
            kind: 'death_prevented',
            targetIds: ['xie-wujiu'],
            sourceName: '命灯未灭',
            timing: 'after',
            reaction: { sourceId: 'xie-wujiu', label: '命灯未灭' },
          },
        ],
      },
    },
    {
      at: 50_000,
      action: {
        sourceId: 'qing-li',
        targetIds: ['sikong-ye'],
        ability: { id: 'seal-script', name: '清心断咒' },
        annotation: '封术未成 · 对方免疫',
        facts: [
          {
            kind: 'status',
            targetIds: ['sikong-ye'],
            operation: 'immune',
            statusId: 'ability-lock',
            statusName: '封术',
            statusType: 'control',
          },
          {
            kind: 'defense',
            targetIds: ['sikong-ye'],
            defense: 'damage_immune',
            detail: '咒术免疫',
            timing: 'after',
          },
        ],
      },
    },
    {
      at: 53_300,
      action: {
        sourceId: 'xie-wujiu',
        targetIds: ['ember-crow'],
        ability: { id: 'final-sword', name: '一剑裁羽' },
        annotation: '重击 · 赤羽离阵',
        facts: [
          {
            kind: 'damage',
            targetIds: ['ember-crow'],
            amount: 286,
            damageType: 'physical',
            critical: true,
          },
          {
            kind: 'unit_died',
            targetIds: ['ember-crow'],
            timing: 'after',
          },
        ],
      },
    },
  ] satisfies ScriptedAction[]
).map((entry) => ({
  ...entry,
  at: Math.round(entry.at * SCRIPT_TIME_SCALE),
}));

function cloneEntities(): RealtimeBattleEntity[] {
  return INITIAL_ENTITIES.map((entity) => ({
    ...entity,
    alive: true,
    effects: [],
    combatResources:
      entity.combatResources?.map((resource) => ({ ...resource })) ?? [],
    actionStates: [],
  }));
}

export class RealtimeBattleSimulation {
  private entities = cloneEntities();
  private elapsedMs = 0;
  private cycle = 1;
  private nextScriptIndex = 0;
  private actionId = 0;
  private focusedEntityId = 'shen-yanqiu';
  private latestAction?: CombatVisualActionInput;
  private pendingResolutions: PendingResolution[] = [];

  constructor(
    private readonly emit: (timeline: CombatVisualTimeline) => void,
  ) {}

  step(deltaMs: number) {
    this.elapsedMs += Math.max(0, Math.min(deltaMs, 100));
    this.clearExpiredState();

    while (
      this.nextScriptIndex < SCRIPT.length &&
      SCRIPT[this.nextScriptIndex].at <= this.elapsedMs
    ) {
      this.beginAction(SCRIPT[this.nextScriptIndex].action);
      this.nextScriptIndex += 1;
    }

    while (
      this.pendingResolutions.length > 0 &&
      this.pendingResolutions[0].at <= this.elapsedMs
    ) {
      const pending = this.pendingResolutions.shift();
      if (pending) this.applyFact(pending.actionId, pending.fact);
    }

    if (this.elapsedMs >= REALTIME_BATTLE_LOOP_DURATION_MS) this.resetCycle();
  }

  focus(entityId: string) {
    if (this.entities.some((entity) => entity.id === entityId)) {
      this.focusedEntityId = entityId;
    }
  }

  command(command: RealtimeBattleCommand) {
    const focused = this.entities.find(
      (entity) => entity.id === this.focusedEntityId,
    );
    const enemyTarget =
      focused?.team === 'enemies' && focused.alive ? focused.id : 'shen-yanqiu';
    const source = this.entities.find((entity) => entity.id === 'xie-wujiu');
    const target = this.entities.find((entity) => entity.id === enemyTarget);

    const actions: Record<RealtimeBattleCommand, RealtimeBattleActionDraft> = {
      'split-light': {
        sourceId: 'xie-wujiu',
        targetIds: [enemyTarget],
        ability: { id: 'split-light', name: '分光剑诀' },
        annotation: '截断其势 · 剑意增长',
        facts: [
          {
            kind: 'damage',
            targetIds: [enemyTarget],
            amount: 88,
            damageType: 'physical',
          },
          {
            kind: 'resource',
            targetIds: ['xie-wujiu'],
            resourceId: 'sword-intent',
            resourceName: '剑意',
            before:
              source?.combatResources.find(
                (resource) => resource.id === 'sword-intent',
              )?.current ?? 0,
            after: Math.min(
              6,
              (source?.combatResources.find(
                (resource) => resource.id === 'sword-intent',
              )?.current ?? 0) + 1,
            ),
            max: 6,
            timing: 'after',
          },
        ],
      },
      'moon-step': {
        sourceId: 'xie-wujiu',
        targetIds: [enemyTarget],
        ability: { id: 'moon-step', name: '踏月步' },
        annotation: '换位迫近 · 轻击',
        facts: [
          {
            kind: 'damage',
            targetIds: [enemyTarget],
            amount: 36,
            damageType: 'physical',
          },
        ],
      },
      'hold-origin': {
        sourceId: 'xie-wujiu',
        targetIds: ['xie-wujiu'],
        ability: { id: 'hold-origin', name: '抱元守一' },
        annotation: '护住自身 · 进入守势',
        facts: [
          {
            kind: 'shield',
            targetIds: ['xie-wujiu'],
            operation: 'gain',
            amount: 86,
          },
          {
            kind: 'status',
            targetIds: ['xie-wujiu'],
            operation: 'apply',
            statusId: 'hold-origin',
            statusName: '守一',
            statusType: 'buff',
            layers: 1,
            durationMs: 7_000,
            timing: 'after',
          },
        ],
      },
      'fox-hunt': {
        sourceId: 'spirit-fox',
        targetIds: [enemyTarget],
        ability: { id: 'fox-hunt', name: '逐影' },
        annotation: '灵宠协击 · 追伤',
        facts: [
          {
            kind: 'damage',
            sourceId: 'spirit-fox',
            targetIds: [enemyTarget],
            amount: Math.min(58, Math.max(1, target?.hp ?? 58)),
            damageType: 'magical',
            damageSource: 'follow_up',
          },
        ],
      },
    };

    this.beginAction(actions[command]);
  }

  snapshot(): RealtimeBattleSnapshot {
    return {
      elapsedMs: this.elapsedMs,
      cycle: this.cycle,
      phase:
        this.elapsedMs < 22_000
          ? '阵势交错'
          : this.elapsedMs < 46_000
            ? '诸法并起'
            : '因果回响',
      focusedEntityId: this.focusedEntityId,
      latestAction: this.latestAction,
      entities: this.entities.map((entity) => ({
        ...entity,
        effects: entity.effects.map((effect) => ({ ...effect })),
        combatResources: entity.combatResources.map((resource) => ({
          ...resource,
        })),
        actionStates: entity.actionStates.map((state) => ({ ...state })),
      })),
    };
  }

  private beginAction(draft: RealtimeBattleActionDraft) {
    const id = `demo-action-${++this.actionId}`;
    const source = this.entities.find((entity) => entity.id === draft.sourceId);
    const qiCost = draft.ability.id === 'dew-return' ? 12 : 20;
    const costFact: CombatVisualFact = {
      id: `${id}:cost`,
      kind: 'resource',
      sourceId: draft.sourceId,
      targetIds: [draft.sourceId],
      resourceId: 'mp',
      resourceName: '灵力',
      before: source?.qi ?? 0,
      after: Math.max(0, (source?.qi ?? 0) - qiCost),
      max: source?.maxQi,
      timing: 'cast',
    };
    const action: CombatVisualActionInput = {
      id,
      sourceId: draft.sourceId,
      targetIds: [...draft.targetIds],
      ability: { ...draft.ability },
      annotation: draft.annotation,
      visual: resolveRealtimeBattleVisualSpec(draft.ability.id),
      facts: [
        costFact,
        ...draft.facts.map(
          (fact, index) =>
            ({
              ...fact,
              id: `${id}:fact-${index + 1}`,
              sourceId: fact.sourceId ?? draft.sourceId,
            }) as CombatVisualFact,
        ),
      ],
    };
    const timeline = projectCombatVisualAction(action);
    for (const command of timeline.commands) {
      if (command.kind !== 'resolve') continue;
      this.pendingResolutions.push({
        at: this.elapsedMs + command.at,
        actionId: id,
        fact: command.fact,
      });
    }
    this.pendingResolutions.sort((left, right) => left.at - right.at);
    this.latestAction = action;
    this.emit(timeline);
  }

  private applyFact(_actionId: string, fact: CombatVisualFact) {
    for (const targetId of fact.targetIds) {
      const target = this.entities.find((entity) => entity.id === targetId);
      if (!target) continue;

      switch (fact.kind) {
        case 'damage': {
          const absorbed = Math.min(target.shield, fact.amount);
          target.shield -= absorbed;
          target.hp = Math.max(1, target.hp - (fact.amount - absorbed));
          break;
        }
        case 'recovery':
          if (fact.resource === 'hp') {
            target.hp = Math.min(target.maxHp, target.hp + fact.amount);
          } else {
            target.qi = Math.min(target.maxQi, target.qi + fact.amount);
          }
          break;
        case 'shield':
          if (fact.operation === 'gain') {
            target.shield = Math.min(220, target.shield + fact.amount);
          } else if (fact.operation === 'break') {
            target.shield = 0;
          } else {
            target.shield = Math.max(0, target.shield - fact.amount);
          }
          break;
        case 'status':
          this.applyStatusFact(target, fact);
          break;
        case 'resource':
          if (fact.resourceId === 'mp') {
            target.qi = Math.max(0, Math.min(target.maxQi, fact.after));
          } else {
            const resource = target.combatResources.find(
              (entry) => entry.id === fact.resourceId,
            );
            if (resource) resource.current = fact.after;
          }
          break;
        case 'action_state':
          this.applyActionStateFact(target, fact);
          break;
        case 'mechanic':
          if (fact.mechanic === 'mana_burn') {
            target.qi = Math.max(0, target.qi - (fact.amount ?? 0));
          }
          if (fact.mechanic === 'damage_defer') {
            this.setActionState(
              target,
              'damage-defer',
              '缓劫',
              'control',
              5_500,
            );
          }
          break;
        case 'death_prevented':
          target.alive = true;
          target.hp = Math.max(1, target.hp);
          break;
        case 'unit_died':
          target.hp = 0;
          target.shield = 0;
          target.alive = false;
          target.actionStates = [];
          break;
        case 'defense':
          break;
      }
    }
  }

  private applyStatusFact(
    target: RealtimeBattleEntity,
    fact: Extract<CombatVisualFact, { kind: 'status' }>,
  ) {
    if (fact.operation === 'remove') {
      target.effects = target.effects.filter(
        (effect) => effect.id !== fact.statusId,
      );
      return;
    }
    if (fact.operation === 'immune') return;
    const existing = target.effects.find(
      (effect) => effect.id === fact.statusId,
    );
    if (existing) {
      existing.layers = fact.layers ?? existing.layers;
      existing.controlVisual = fact.controlVisual ?? existing.controlVisual;
      existing.until = this.elapsedMs + (fact.durationMs ?? 5_500);
      return;
    }
    target.effects.push({
      id: fact.statusId,
      label: fact.statusName,
      tone: fact.statusType === 'buff' ? 'buff' : 'debuff',
      statusType: fact.statusType,
      controlVisual: fact.controlVisual,
      layers: fact.layers ?? 1,
      until: this.elapsedMs + (fact.durationMs ?? 5_500),
    });
  }

  private applyActionStateFact(
    target: RealtimeBattleEntity,
    fact: Extract<CombatVisualFact, { kind: 'action_state' }>,
  ) {
    const id = `${fact.stateType}:${fact.stateName}`;
    if (fact.phase === 'entered') {
      this.setActionState(
        target,
        id,
        fact.stateName,
        fact.stateType === 'ability_mode' ? 'mode' : 'preparing',
        fact.durationMs ?? 6_000,
      );
      return;
    }
    target.actionStates = target.actionStates.filter(
      (state) => state.id !== id,
    );
  }

  private setActionState(
    entity: RealtimeBattleEntity,
    id: string,
    label: string,
    tone: RealtimeBattleActionState['tone'],
    duration: number,
  ) {
    entity.actionStates = entity.actionStates.filter(
      (state) => state.id !== id,
    );
    entity.actionStates.push({
      id,
      label,
      tone,
      until: this.elapsedMs + duration,
    });
  }

  private clearExpiredState() {
    for (const entity of this.entities) {
      entity.effects = entity.effects.filter(
        (effect) => effect.until > this.elapsedMs,
      );
      entity.actionStates = entity.actionStates.filter(
        (state) => state.until > this.elapsedMs,
      );
    }
  }

  private resetCycle() {
    this.entities = cloneEntities();
    this.elapsedMs = 0;
    this.nextScriptIndex = 0;
    this.pendingResolutions = [];
    this.latestAction = undefined;
    this.cycle += 1;
  }
}

export function createInitialRealtimeBattleSnapshot(): RealtimeBattleSnapshot {
  return {
    elapsedMs: 0,
    cycle: 1,
    phase: '阵势交错',
    focusedEntityId: 'shen-yanqiu',
    entities: cloneEntities(),
  };
}
