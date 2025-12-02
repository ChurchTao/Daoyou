import {
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

  // 基础属性
  vitality: integer('vitality').notNull(),
  spirit: integer('spirit').notNull(),
  wisdom: integer('wisdom').notNull(),
  speed: integer('speed').notNull(),
  willpower: integer('willpower').notNull(),

  max_skills: integer('max_skills').notNull().default(4),

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
  type: varchar('type', { length: 20 }).notNull(), // attack | heal | control | debuff | buff
  element: varchar('element', { length: 10 }).notNull(),
  power: integer('power').notNull(), // 30-150
  cost: integer('cost').default(0),
  cooldown: integer('cooldown').notNull().default(0),
  effect: varchar('effect', { length: 50 }), // burn | bleed | poison | stun | ...
  duration: integer('duration'), // 持续回合数
  target_self: integer('target_self').default(0), // 0 = false, 1 = true
  createdAt: timestamp('created_at').defaultNow(),
});

// 法宝表（1对多，不在创建时生成，由用户后续添加）
export const artifacts = pgTable('wanjiedaoyou_artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  slot: varchar('slot', { length: 20 }).notNull(), // weapon | armor | accessory
  element: varchar('element', { length: 10 }).notNull(),
  bonus: jsonb('bonus').notNull(), // { vitality?, spirit?, wisdom?, speed?, willpower? }
  special_effects: jsonb('special_effects').default([]), // ArtifactEffect[]
  curses: jsonb('curses').default([]), // ArtifactEffect[]
  createdAt: timestamp('created_at').defaultNow(),
});

// 消耗品表（1对多，不在创建时生成，由用户后续添加）
export const consumables = pgTable('wanjiedaoyou_consumables', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // heal | buff | revive | breakthrough
  effect: jsonb('effect'), // ConsumableEffect
  createdAt: timestamp('created_at').defaultNow(),
});

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
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // 过期时间，在程序中设置
});
