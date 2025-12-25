import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// ===== 新一代修仙游戏数据库 Schema =====
// 基于 basic.md 中的新 Cultivator 模型设计

// 角色主表
export const cultivators = pgTable('wanjiedaoyou_cultivators', {
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

  spirit_stones: integer('spirit_stones').notNull().default(0), // 灵石
  last_yield_at: timestamp('last_yield_at').defaultNow(),

  max_skills: integer('max_skills').notNull().default(4),
  balance_notes: text('balance_notes'),

  // 持久状态（用于存储战斗/副本中产生的持久状态）
  persistent_statuses: jsonb('persistent_statuses').default([]),

  // 修为进度系统
  cultivation_progress: jsonb('cultivation_progress').default({}),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// 灵根表（1对多）
export const spiritualRoots = pgTable('wanjiedaoyou_spiritual_roots', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  element: varchar('element', { length: 10 }).notNull(), // 金 | 木 | 水 | 火 | 土 | 风 | 雷 | 冰 | 无
  strength: integer('strength').notNull(), // 0-100
  grade: varchar('grade', { length: 20 }), // 天灵根 | 真灵根 | 伪灵根
  createdAt: timestamp('created_at').defaultNow(),
});

// 先天命格表（1对多）
export const preHeavenFates = pgTable('wanjiedaoyou_pre_heaven_fates', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 吉 | 凶
  quality: varchar('quality', { length: 10 }), // 凡品 | 灵品 | 玄品 | 真品
  attribute_mod: jsonb('attribute_mod').notNull(), // { vitality?, spirit?, wisdom?, speed?, willpower? }
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 功法表（1对多）
export const cultivationTechniques = pgTable(
  'wanjiedaoyou_cultivation_techniques',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .references(() => cultivators.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    grade: varchar('grade', { length: 20 }), // 天阶上品 | 天阶中品 | 天阶下品 | 地阶上品 | ... | 黄阶下品
    bonus: jsonb('bonus').notNull(), // { vitality?, spirit?, wisdom?, speed?, willpower? }
    required_realm: varchar('required_realm', { length: 20 }).notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
);

// 技能表（1对多）
export const skills = pgTable('wanjiedaoyou_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  prompt: text('prompt').notNull().default(''),
  type: varchar('type', { length: 20 }).notNull(), // attack | heal | control | debuff | buff
  element: varchar('element', { length: 10 }).notNull(),
  grade: varchar('grade', { length: 20 }), // 天阶上品 | 天阶中品 | 天阶下品 | 地阶上品 | ... | 黄阶下品
  power: integer('power').notNull(), // 30-150
  cost: integer('cost').default(0),
  cooldown: integer('cooldown').notNull().default(0),
  effect: varchar('effect', { length: 50 }), // burn | bleed | poison | stun | ...
  duration: integer('duration'), // 持续回合数
  target_self: integer('target_self').default(0), // 0 = false, 1 = true
  description: text('description'),
  score: integer('score').notNull().default(0), // 评分
  createdAt: timestamp('created_at').defaultNow(),
});

// 材料表（1对多）
export const materials = pgTable('wanjiedaoyou_materials', {
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
});

// 法宝表（1对多，不在创建时生成，由用户后续添加）
export const artifacts = pgTable('wanjiedaoyou_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  prompt: varchar('prompt', { length: 200 }).notNull().default(''), // 提示词
  quality: varchar('quality', { length: 20 }).notNull().default('凡品'), // 凡品 | 下品 | 中品 | 上品 | 极品 | 仙品 | 神品
  required_realm: varchar('required_realm', { length: 20 })
    .notNull()
    .default('练气'),
  slot: varchar('slot', { length: 20 }).notNull(), // weapon | armor | accessory
  element: varchar('element', { length: 10 }).notNull(),
  bonus: jsonb('bonus').notNull(), // { vitality?, spirit?, wisdom?, speed?, willpower? }
  special_effects: jsonb('special_effects').default([]), // ArtifactEffect[]
  curses: jsonb('curses').default([]), // ArtifactEffect[]
  description: text('description'),
  score: integer('score').notNull().default(0), // 评分
  createdAt: timestamp('created_at').defaultNow(),
});

// 消耗品表（1对多，不在创建时生成，由用户后续添加）
export const consumables = pgTable('wanjiedaoyou_consumables', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 丹药
  prompt: varchar('prompt', { length: 200 }).notNull().default(''), // 提示词
  quality: varchar('quality', { length: 20 }).notNull().default('凡品'), // 凡品 | 下品 | 中品 | 上品 | 极品 | 仙品 | 神品
  effect: jsonb('effect'), // ConsumableEffect
  quantity: integer('quantity').notNull().default(1),
  description: text('description'),
  score: integer('score').notNull().default(0), // 评分
  createdAt: timestamp('created_at').defaultNow(),
});

export const retreatRecords = pgTable('wanjiedaoyou_retreat_records', {
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
});

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
);

// 装备状态表（1对1）
export const equippedItems = pgTable('wanjiedaoyou_equipped_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  weapon_id: uuid('weapon_id').references(() => artifacts.id, {
    onDelete: 'set null',
  }),
  armor_id: uuid('armor_id').references(() => artifacts.id, {
    onDelete: 'set null',
  }),
  accessory_id: uuid('accessory_id').references(() => artifacts.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// 临时角色表 - 用于存放AI生成的角色结果，用户确认后保存到正式表
export const tempCultivators = pgTable('wanjiedaoyou_temp_cultivators', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(), // 关联到用户
  cultivatorData: jsonb('cultivator_data').notNull(), // 完整的角色数据，包含所有信息
  availableFates: jsonb('available_fates'), // 10个可选的先天气运
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // 过期时间，在程序中设置
});

// 战斗记录表 - 存放每场战斗的完整结果快照与战报
export const battleRecords = pgTable('wanjiedaoyou_battle_records', {
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
});

// 邮件/传音玉简表
export const mails = pgTable('wanjiedaoyou_mails', {
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
});

// 单人副本历史记录表
export const dungeonHistories = pgTable('wanjiedaoyou_dungeon_histories', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  theme: varchar('theme', { length: 100 }).notNull(), // 副本主题
  result: jsonb('result').notNull(), // 副本结算结果 { ending_narrative, settlement: { reward_tier, potential_items, resource_loss } }
  log: text('log').notNull(), // 完整交互日志
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
