import {
  boolean,
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type {
  AlchemyFormulaBlueprint,
  AlchemyFormulaMastery,
  AlchemyFormulaPattern,
  PillFamily,
} from '@shared/types/consumable';
import type {
  ItemLibraryEditorConfig,
  ItemLibraryPayload,
} from '@shared/lib/itemLibrary';
import type { MailAttachment } from '@shared/types/mail';
import type { TowerPreparedEnemy } from '@shared/lib/tower';
import type { PlayerStateDomain } from '@shared/contracts/player';

// ===== 新一代修仙游戏数据库 Schema =====
// 基于 basic.md 中的新 Cultivator 模型设计

// 角色主表
export const cultivators = pgTable(
  'wanjiedaoyou_cultivators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    title: varchar('title', { length: 50 }),
    gender: varchar('gender', { length: 10 }), // 男 | 女 | 无
    origin: varchar('origin', { length: 100 }),
    personality: text('personality'),
    background: text('background'),
    prompt: text('prompt').notNull(), // 用户原始输入

    // 境界相关
    realm: varchar('realm', { length: 20 }).notNull(), // 炼气 | 筑基 | 金丹 | ...
    realm_stage: varchar('realm_stage', { length: 10 }).notNull(), // 初期 | 中期 | 后期 | 圆满
    age: integer('age').notNull().default(18),
    lifespan: integer('lifespan').notNull().default(100),
    closedDoorYearsTotal: integer('closed_door_years_total').default(0),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    diedAt: timestamp('died_at'),

    // 基础属性
    vitality: integer('vitality').notNull(),
    spirit: integer('spirit').notNull(),
    wisdom: integer('wisdom').notNull(),
    speed: integer('speed').notNull(),
    willpower: integer('willpower').notNull(),
    unallocatedAttributePoints: integer('unallocated_attribute_points')
      .notNull()
      .default(0),

    spirit_stones: integer('spirit_stones').notNull().default(0), // 灵石
    reputation: integer('reputation').notNull().default(0), // 声望
    qi: integer('qi').notNull().default(200), // 天地灵气
    qiLastRefreshedAt: timestamp('qi_last_refreshed_at').notNull().defaultNow(),
    last_yield_at: timestamp('last_yield_at').defaultNow(),
    balance_notes: text('balance_notes'),

    // 角色当前状态（用于存储战斗/副本中产生的持久状态）
    condition: jsonb('condition').notNull().default({}),
    gameSettings: jsonb('game_settings').notNull().default({}),

    // 修为进度系统
    cultivation_progress: jsonb('cultivation_progress').default({}),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('cultivators_user_status_updated_idx').on(
      table.userId,
      table.status,
      table.updatedAt,
    ),
    index('cultivators_status_created_idx').on(table.status, table.createdAt),
    index('cultivators_status_spirit_stones_idx').on(
      table.status,
      table.spirit_stones,
    ),
  ],
);

export type AccountDeletionStatus = 'pending' | 'completed';

// 账号注销留档：不关联 Better Auth 或角色外键，确保账号删除后仍可用于后续清理。
export const accountDeletionRecords = pgTable(
  'wanjiedaoyou_account_deletion_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    cultivatorIds: uuid('cultivator_ids').array().notNull(),
    status: varchar('status', { length: 20 })
      .$type<AccountDeletionStatus>()
      .notNull()
      .default('pending'),
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    uniqueIndex('account_deletion_records_user_uidx').on(table.userId),
    index('account_deletion_records_status_requested_idx').on(
      table.status,
      table.requestedAt,
    ),
  ],
);

export const qiLogs = pgTable(
  'wanjiedaoyou_qi_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    actionInstanceId: varchar('action_instance_id', { length: 128 }).notNull(),
    status: varchar('status', { length: 32 }).notNull(),
    qiCost: integer('qi_cost').notNull().default(0),
    qiGain: integer('qi_gain').notNull().default(0),
    qiBefore: integer('qi_before').notNull(),
    qiAfter: integer('qi_after').notNull(),
    source: varchar('source', { length: 64 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('qi_logs_action_instance_uidx').on(table.actionInstanceId),
    index('qi_logs_cultivator_created_idx').on(
      table.cultivatorId,
      table.createdAt,
    ),
    index('qi_logs_status_created_idx').on(table.status, table.createdAt),
  ],
);

export const cultivatorStateVersions = pgTable(
  'wanjiedaoyou_cultivator_state_versions',
  {
    cultivatorId: uuid('cultivator_id')
      .primaryKey()
      .references(() => cultivators.id, { onDelete: 'cascade' }),
    globalVersion: bigint('global_version', { mode: 'number' })
      .notNull()
      .default(0),
    profileVersion: bigint('profile_version', { mode: 'number' })
      .notNull()
      .default(0),
    conditionVersion: bigint('condition_version', { mode: 'number' })
      .notNull()
      .default(0),
    progressVersion: bigint('progress_version', { mode: 'number' })
      .notNull()
      .default(0),
    currencyVersion: bigint('currency_version', { mode: 'number' })
      .notNull()
      .default(0),
    loadoutVersion: bigint('loadout_version', { mode: 'number' })
      .notNull()
      .default(0),
    mailVersion: bigint('mail_version', { mode: 'number' })
      .notNull()
      .default(0),
    tasksVersion: bigint('tasks_version', { mode: 'number' })
      .notNull()
      .default(0),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
);

export const playerStateEvents = pgTable(
  'wanjiedaoyou_player_state_events',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').notNull(),
    globalVersion: bigint('global_version', { mode: 'number' }).notNull(),
    domainVersion: bigint('domain_version', { mode: 'number' }).notNull(),
    domain: varchar('domain', { length: 32 }).$type<PlayerStateDomain>().notNull(),
    eventType: varchar('event_type', { length: 96 }).notNull(),
    patch: jsonb('patch').notNull().default({}),
    invalidates: jsonb('invalidates')
      .$type<PlayerStateDomain[]>()
      .notNull()
      .default([]),
    source: varchar('source', { length: 96 }).notNull(),
    requestId: varchar('request_id', { length: 128 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('player_state_events_cultivator_version_idx').on(
      table.cultivatorId,
      table.globalVersion,
      table.id,
    ),
    index('player_state_events_user_idx').on(table.userId),
    index('player_state_events_created_idx').on(table.createdAt),
  ],
);

// 灵根表（1对多）
export const spiritualRoots = pgTable(
  'wanjiedaoyou_spiritual_roots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    element: varchar('element', { length: 10 }).notNull(), // 金 | 木 | 水 | 火 | 土 | 风 | 雷 | 冰 | 无
    strength: integer('strength').notNull(), // 0-100
    marrowWashBonus: integer('marrow_wash_bonus').notNull().default(0),
    grade: varchar('grade', { length: 20 }), // 天灵根 | 真灵根 | 伪灵根 | 变异灵根
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('spiritual_roots_cultivator_idx').on(table.cultivatorId)],
);

// 先天命格表（1对多）
export const preHeavenFates = pgTable(
  'wanjiedaoyou_pre_heaven_fates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    quality: varchar('quality', { length: 10 }), // 凡品 | 灵品 | 玄品 | 真品
    details: jsonb('details').default({}),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('pre_heaven_fates_cultivator_idx').on(table.cultivatorId)],
);

// 材料表（1对多）
export const materials = pgTable(
  'wanjiedaoyou_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // herb | ore | monster | other
    rank: varchar('rank', { length: 20 }).notNull(), // 凡品 | 下品 | 中品 | 上品 | 极品 | 仙品 | 神品
    element: varchar('element', { length: 10 }),
    description: text('description'),
    details: jsonb('details').default({}), // 额外属性
    quantity: integer('quantity').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('materials_cultivator_idx').on(table.cultivatorId),
    index('materials_cultivator_name_idx').on(table.cultivatorId, table.name),
    index('materials_cultivator_name_rank_idx').on(
      table.cultivatorId,
      table.name,
      table.rank,
    ),
  ],
);

// 消耗品表（1对多，不在创建时生成，由用户后续添加）
export const consumables = pgTable(
  'wanjiedaoyou_consumables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // 丹药 | 符箓
    prompt: varchar('prompt', { length: 200 }).notNull().default(''), // 提示词
    quality: varchar('quality', { length: 20 }).notNull().default('凡品'), // 凡品 | 下品 | 中品 | 上品 | 极品 | 仙品 | 神品
    spec: jsonb('spec').notNull().default({}),
    quantity: integer('quantity').notNull().default(1),
    description: text('description'),
    score: integer('score').notNull().default(0), // 评分
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('consumables_cultivator_idx').on(table.cultivatorId),
    index('consumables_cultivator_name_quality_idx').on(
      table.cultivatorId,
      table.name,
      table.quality,
    ),
    index('consumables_score_idx').on(table.score),
  ],
);

export const alchemyFormulas = pgTable(
  'wanjiedaoyou_alchemy_formulas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull().default(''),
    family: varchar('family', { length: 20 }).$type<PillFamily>().notNull(),
    pattern: jsonb('pattern').$type<AlchemyFormulaPattern>().notNull(),
    blueprint: jsonb('blueprint').$type<AlchemyFormulaBlueprint>().notNull(),
    mastery: jsonb('mastery')
      .$type<AlchemyFormulaMastery>()
      .notNull()
      .default({ level: 0, exp: 0 }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('alchemy_formulas_cultivator_updated_idx').on(
      table.cultivatorId,
      table.updatedAt,
    ),
    index('alchemy_formulas_cultivator_family_idx').on(
      table.cultivatorId,
      table.family,
    ),
  ],
);

export const retreatRecords = pgTable(
  'wanjiedaoyou_retreat_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    realm: varchar('realm', { length: 20 }).notNull(),
    realm_stage: varchar('realm_stage', { length: 10 }).notNull(),
    years: integer('years').notNull(),
    success: boolean('success').notNull().default(false),
    chance: doublePrecision('chance').notNull(),
    roll: doublePrecision('roll').notNull(),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    modifiers: jsonb('modifiers').notNull(),
  },
  (table) => [
    index('retreat_records_cultivator_timestamp_idx').on(
      table.cultivatorId,
      table.timestamp,
    ),
  ],
);

export const breakthroughHistory = pgTable(
  'wanjiedaoyou_breakthrough_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    from_realm: varchar('from_realm', { length: 20 }).notNull(),
    from_stage: varchar('from_stage', { length: 10 }).notNull(),
    to_realm: varchar('to_realm', { length: 20 }).notNull(),
    to_stage: varchar('to_stage', { length: 10 }).notNull(),
    age: integer('age').notNull(),
    years_spent: integer('years_spent').notNull(),
    story: text('story'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('breakthrough_history_cultivator_created_idx').on(
      table.cultivatorId,
      table.createdAt,
    ),
  ],
);

export const cultivatorTasks = pgTable(
  'wanjiedaoyou_cultivator_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    definitionId: varchar('definition_id', { length: 120 }).notNull(),
    category: varchar('category', { length: 40 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    currentStage: varchar('current_stage', { length: 120 }),
    objectives: jsonb('objectives').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    completedAt: timestamp('completed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('cultivator_tasks_cultivator_status_updated_idx').on(
      table.cultivatorId,
      table.status,
      table.updatedAt,
    ),
    uniqueIndex('cultivator_tasks_cultivator_definition_unique').on(
      table.cultivatorId,
      table.definitionId,
    ),
  ],
);

// 战斗记录表 - 存放每场战斗的完整结果快照与战报
export const battleRecords = pgTable(
  'wanjiedaoyou_battle_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 关联用户和正式角色
    userId: uuid('user_id').notNull(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),

    // 挑战相关字段
    challengeType: varchar('challenge_type', { length: 20 }), // 'challenge' | 'challenged' | 'normal'
    opponentCultivatorId: uuid('opponent_cultivator_id').references(
      () => cultivators.id,
      { onDelete: 'set null' },
    ), // 对手角色ID（用于被挑战记录）

    // 战斗结果快照（完整 BattleEngineResult 或其扩展）
    battleResult: jsonb('battle_result').notNull(),

    // AIGC 生成的战斗播报完整文本
    battleReport: text('battle_report'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('battle_records_cultivator_created_idx').on(
      table.cultivatorId,
      table.createdAt,
    ),
    index('battle_records_opponent_created_idx').on(
      table.opponentCultivatorId,
      table.createdAt,
    ),
  ],
);

// 战斗记录表 v2 - 新版战斗引擎记录（唯一产品路径）
export const battleRecordsV2 = pgTable(
  'wanjiedaoyou_battle_records_v2',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    battleType: varchar('battle_type', { length: 20 })
      .notNull()
      .default('normal'), // challenge | challenged | normal
    opponentCultivatorId: uuid('opponent_cultivator_id').references(
      () => cultivators.id,
      { onDelete: 'set null' },
    ),
    engineVersion: varchar('engine_version', { length: 40 })
      .notNull()
      .default('battle-v5'),
    resultVersion: integer('result_version').notNull().default(2),
    battleResult: jsonb('battle_result').notNull(),
    battleReport: text('battle_report'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('battle_records_v2_cultivator_created_idx').on(
      table.cultivatorId,
      table.createdAt,
    ),
    index('battle_records_v2_opponent_created_idx').on(
      table.opponentCultivatorId,
      table.createdAt,
    ),
    index('battle_records_v2_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
  ],
);

// 邮件/传音玉简表
export const mails = pgTable(
  'wanjiedaoyou_mails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content').notNull(),
    type: varchar('type', { length: 20 }).notNull().default('system'), // system | reward
    attachments: jsonb('attachments'), // Array of { type, id?, name, quantity, data? }
    isRead: boolean('is_read').notNull().default(false),
    isClaimed: boolean('is_claimed').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('mails_cultivator_created_idx').on(
      table.cultivatorId,
      table.createdAt,
    ),
    index('mails_cultivator_is_read_created_idx').on(
      table.cultivatorId,
      table.isRead,
      table.createdAt,
    ),
  ],
);

// 好友名录：双向好友会写入两条记录，便于按当前角色快速查询
export const cultivatorFriends = pgTable(
  'wanjiedaoyou_cultivator_friends',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    friendCultivatorId: uuid('friend_cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('cultivator_friends_pair_uidx').on(
      table.cultivatorId,
      table.friendCultivatorId,
    ),
    index('cultivator_friends_friend_idx').on(table.friendCultivatorId),
  ],
);

// 兑换码表
export const redeemCodes = pgTable(
  'wanjiedaoyou_redeem_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    rewardPresetId: varchar('reward_preset_id', { length: 100 }).notNull(),
    rewardAttachments: jsonb('reward_attachments').$type<MailAttachment[]>(),
    mailTitle: varchar('mail_title', { length: 200 }).notNull(),
    mailContent: text('mail_content').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'), // active | disabled
    totalLimit: integer('total_limit'),
    claimedCount: integer('claimed_count').notNull().default(0),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('redeem_codes_code_unique').on(table.code),
    index('redeem_codes_status_created_idx').on(table.status, table.createdAt),
    index('redeem_codes_created_idx').on(table.createdAt),
  ],
);

// 兑换记录表
export const redeemCodeClaims = pgTable(
  'wanjiedaoyou_redeem_code_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    redeemCodeId: uuid('redeem_code_id')
      .references(() => redeemCodes.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').notNull(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    mailId: uuid('mail_id').references(() => mails.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('redeem_code_claims_code_user_unique').on(
      table.redeemCodeId,
      table.userId,
    ),
    index('redeem_code_claims_user_idx').on(table.userId),
    index('redeem_code_claims_code_idx').on(table.redeemCodeId),
  ],
);

// 运营模板表
export const adminMessageTemplates = pgTable(
  'wanjiedaoyou_admin_message_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    channel: varchar('channel', { length: 20 }).notNull(), // email | game_mail
    name: varchar('name', { length: 120 }).notNull(),
    subjectTemplate: varchar('subject_template', { length: 300 }),
    contentTemplate: text('content_template').notNull(),
    defaultPayload: jsonb('default_payload').notNull().default({}),
    status: varchar('status', { length: 20 }).notNull().default('active'), // active | disabled
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('admin_templates_channel_status_created_idx').on(
      table.channel,
      table.status,
      table.createdAt,
    ),
  ],
);

// 应用级键值配置（运营可改，避免发版）
export const appSettings = pgTable('wanjiedaoyou_app_settings', {
  key: varchar('key', { length: 128 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by'),
});

export const itemLibrary = pgTable(
  'wanjiedaoyou_item_library',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: varchar('item_id', { length: 120 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(), // material | consumable | artifact
    status: varchar('status', { length: 20 }).notNull().default('published'),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    quality: varchar('quality', { length: 20 }),
    element: varchar('element', { length: 10 }),
    category: varchar('category', { length: 40 }),
    sampleKey: doublePrecision('sample_key').notNull().default(0),
    payload: jsonb('payload').$type<ItemLibraryPayload>().notNull(),
    editorConfig: jsonb('editor_config')
      .$type<ItemLibraryEditorConfig>()
      .notNull()
      .default({}),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('item_library_item_id_unique').on(table.itemId),
    index('item_library_status_type_idx').on(table.status, table.type),
    index('item_library_material_sample_idx').on(
      table.type,
      table.status,
      table.category,
      table.quality,
      table.sampleKey,
    ),
    index('item_library_name_idx').on(table.name),
  ],
);

export const reputationShopItems = pgTable(
  'wanjiedaoyou_reputation_shop_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemLibraryItemId: varchar('item_library_item_id', { length: 120 })
      .notNull()
      .references(() => itemLibrary.itemId),
    price: integer('price').notNull(),
    quantity: integer('quantity').notNull().default(1),
    perUserLimit: integer('per_user_limit'),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('reputation_shop_item_library_item_uidx').on(
      table.itemLibraryItemId,
    ),
    index('reputation_shop_status_sort_idx').on(
      table.status,
      table.sortOrder,
      table.updatedAt,
    ),
  ],
);

export const reputationShopPurchases = pgTable(
  'wanjiedaoyou_reputation_shop_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    shopItemId: uuid('shop_item_id')
      .notNull()
      .references(() => reputationShopItems.id, { onDelete: 'cascade' }),
    cultivatorId: uuid('cultivator_id')
      .notNull()
      .references(() => cultivators.id, { onDelete: 'cascade' }),
    itemLibraryItemId: varchar('item_library_item_id', { length: 120 }).notNull(),
    quantity: integer('quantity').notNull(),
    reputationCost: integer('reputation_cost').notNull(),
    purchaseWeek: varchar('purchase_week', { length: 10 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reputation_shop_purchases_cultivator_item_idx').on(
      table.cultivatorId,
      table.shopItemId,
    ),
    index('reputation_shop_purchases_week_idx').on(
      table.cultivatorId,
      table.shopItemId,
      table.purchaseWeek,
    ),
    index('reputation_shop_purchases_created_idx').on(table.createdAt),
  ],
);

// 单人副本历史记录表
export const dungeonHistories = pgTable(
  'wanjiedaoyou_dungeon_histories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    theme: varchar('theme', { length: 100 }).notNull(), // 副本主题
    result: jsonb('result').notNull(), // 副本结算结果 { ending_narrative, settlement: { reward_tier, potential_items, resource_loss } }
    log: text('log').notNull(), // 完整交互日志
    realGains: jsonb('real_gains'), // 实际发放的奖励 ResourceOperation[]
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('dungeon_histories_cultivator_created_idx').on(
      table.cultivatorId,
      table.createdAt,
    ),
  ],
);

// 进行中副本权威状态表
export const dungeonRuns = pgTable(
  'wanjiedaoyou_dungeon_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    mapNodeId: varchar('map_node_id', { length: 100 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('EXPLORING'),
    currentRound: integer('current_round').notNull().default(1),
    maxRounds: integer('max_rounds').notNull().default(5),
    dangerScore: integer('danger_score').notNull().default(10),
    runState: jsonb('run_state').notNull(),
    costLedger: jsonb('cost_ledger').notNull().default([]),
    gainLedger: jsonb('gain_ledger').notNull().default([]),
    pendingAction: jsonb('pending_action'),
    activeBattleId: uuid('active_battle_id'),
    battlePayload: jsonb('battle_payload'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    endedAt: timestamp('ended_at'),
  },
  (table) => [
    index('dungeon_runs_cultivator_status_updated_idx').on(
      table.cultivatorId,
      table.status,
      table.updatedAt,
    ),
    index('dungeon_runs_status_updated_idx').on(table.status, table.updatedAt),
  ],
);

// 蜃楼幻境每周预生成敌人，按层拆分以避免整包 JSON 读写
export const towerEnemyFloors = pgTable(
  'wanjiedaoyou_tower_enemy_floors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seasonKey: varchar('season_key', { length: 40 }).notNull(),
    realm: varchar('realm', { length: 20 }).notNull(),
    floor: integer('floor').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ready'),
    schemaVersion: integer('schema_version').notNull().default(1),
    enemy: jsonb('enemy').$type<TowerPreparedEnemy>(),
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
    errorMessage: text('error_message'),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('tower_enemy_floors_season_realm_floor_uidx').on(
      table.seasonKey,
      table.realm,
      table.floor,
    ),
    index('tower_enemy_floors_realm_floor_generated_idx').on(
      table.realm,
      table.floor,
      table.generatedAt,
    ),
    index('tower_enemy_floors_season_realm_status_idx').on(
      table.seasonKey,
      table.realm,
      table.status,
    ),
  ],
);

// 拍卖行表
export const auctionListings = pgTable(
  'wanjiedaoyou_auction_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 卖家信息
    sellerId: uuid('seller_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    sellerName: varchar('seller_name', { length: 100 }).notNull(), // 冗余存储，方便展示

    // 物品信息
    itemType: varchar('item_type', { length: 20 }).notNull(), // material | artifact | consumable
    itemId: uuid('item_id').notNull(), // 原物品ID（引用），售出后可清理
    itemName: varchar('item_name', { length: 200 }).notNull().default(''),
    itemQuality: varchar('item_quality', { length: 20 }).notNull().default(''),
    itemCategory: varchar('item_category', { length: 50 }).notNull().default(''),

    // 物品快照（完整数据，保证下架后仍能展示）
    itemSnapshot: jsonb('item_snapshot').notNull(),

    // 价格与状态
    price: integer('price').notNull(), // 一口价（灵石）
    status: varchar('status', { length: 20 }).notNull().default('active'), // active | sold | expired | cancelled
    visibility: varchar('visibility', { length: 20 }).notNull().default('public'), // public | private
    targetCultivatorId: uuid('target_cultivator_id').references(
      () => cultivators.id,
      { onDelete: 'set null' },
    ),
    targetCultivatorName: varchar('target_cultivator_name', { length: 100 }),

    // 时间戳
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(), // 上架时间 + 48小时
    soldAt: timestamp('sold_at'), // 售出时间
  },
  (table) => [
    // 复合索引：用于筛选 active 并处理过期扫描
    index('auction_status_expires_created_idx').on(
      table.status,
      table.expiresAt,
      table.createdAt,
    ),
    // 复合索引：用于校验寄售位数量
    index('auction_seller_status_idx').on(table.sellerId, table.status),
    // 复合索引：用于 active 列表按价格排序/过滤
    index('auction_status_expires_price_idx').on(
      table.status,
      table.expiresAt,
      table.price,
    ),
    index('auction_status_type_expires_created_idx').on(
      table.status,
      table.itemType,
      table.expiresAt,
      table.createdAt,
    ),
    // 复合索引：用于 active 列表按类型筛选
    index('auction_status_expires_item_type_idx').on(
      table.status,
      table.expiresAt,
      table.itemType,
    ),
    index('auction_status_type_category_expires_created_idx').on(
      table.status,
      table.itemType,
      table.itemCategory,
      table.expiresAt,
      table.createdAt,
    ),
    index('auction_status_type_quality_expires_created_idx').on(
      table.status,
      table.itemType,
      table.itemQuality,
      table.expiresAt,
      table.createdAt,
    ),
    index('auction_status_item_name_expires_created_idx').on(
      table.status,
      table.itemName,
      table.expiresAt,
      table.createdAt,
    ),
    index('auction_status_seller_name_expires_created_idx').on(
      table.status,
      table.sellerName,
      table.expiresAt,
      table.createdAt,
    ),
    index('auction_visibility_target_status_idx').on(
      table.visibility,
      table.targetCultivatorId,
      table.status,
    ),
  ],
);

// 赌战表
export const betBattles = pgTable(
  'wanjiedaoyou_bet_battles',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 发起者
    creatorId: uuid('creator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    creatorName: varchar('creator_name', { length: 100 }).notNull(),

    // 状态
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | matched | cancelled | expired | settled

    // 可应战境界范围
    minRealm: varchar('min_realm', { length: 20 }).notNull(),
    maxRealm: varchar('max_realm', { length: 20 }).notNull(),
    taunt: varchar('taunt', { length: 20 }),

    // 押注快照
    creatorStakeSnapshot: jsonb('creator_stake_snapshot').notNull(),
    challengerStakeSnapshot: jsonb('challenger_stake_snapshot'),

    // 应战者
    challengerId: uuid('challenger_id').references(() => cultivators.id, {
      onDelete: 'set null',
    }),
    challengerName: varchar('challenger_name', { length: 100 }),

    // 结算结果
    winnerCultivatorId: uuid('winner_cultivator_id').references(
      () => cultivators.id,
      {
        onDelete: 'set null',
      },
    ),
    battleRecordId: uuid('battle_record_id').references(
      () => battleRecords.id,
      {
        onDelete: 'set null',
      },
    ),
    battleRecordV2Id: uuid('battle_record_v2_id').references(
      () => battleRecordsV2.id,
      {
        onDelete: 'set null',
      },
    ),

    // 时间
    expiresAt: timestamp('expires_at').notNull(),
    matchedAt: timestamp('matched_at'),
    settledAt: timestamp('settled_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('bet_battles_status_expires_idx').on(table.status, table.expiresAt),
    index('bet_battles_creator_status_idx').on(table.creatorId, table.status),
    index('bet_battles_status_created_idx').on(table.status, table.createdAt),
  ],
);

// 用户反馈表
export const feedbacks = pgTable(
  'wanjiedaoyou_feedbacks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    cultivatorId: uuid('cultivator_id').references(() => cultivators.id, {
      onDelete: 'set null',
    }),
    type: varchar('type', { length: 20 }).notNull(), // bug | feature | balance | other
    content: text('content').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | processing | resolved | closed
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('feedback_user_created_at_idx').on(table.userId, table.createdAt),
    index('feedback_status_type_created_at_idx').on(
      table.status,
      table.type,
      table.createdAt,
    ),
  ],
);

// ===== 造物引擎 V2 统一产物表 =====
// 所有 v2 产物（skill/artifact/gongfa）存入同一张表，通过 product_type 区分
export const creationProducts = pgTable(
  'wanjiedaoyou_creation_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    productType: varchar('product_type', { length: 20 }).notNull(), // skill | artifact | gongfa
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    element: varchar('element', { length: 10 }), // 主元素，从 abilityTags 提取
    quality: varchar('quality', { length: 20 }), // 品质等级，从 balanceMetrics 推算
    slot: varchar('slot', { length: 20 }), // 仅 artifact: weapon | armor | accessory
    score: integer('score').notNull().default(0), // 排行榜评分
    isEquipped: boolean('is_equipped').notNull().default(false), // 三类产物通用生效态；法宝表示装备状态
    productModel: jsonb('product_model').notNull(), // 完整 CreationProductModel 快照
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('creation_products_cultivator_type_idx').on(
      table.cultivatorId,
      table.productType,
    ),
    index('creation_products_type_score_idx').on(
      table.productType,
      table.score,
    ),
    index('creation_products_equipped_idx').on(
      table.cultivatorId,
      table.isEquipped,
    ),
  ],
);
