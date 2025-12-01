import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// 角色表
export const cultivators = pgTable('wanjiedaoyou_cultivators', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  prompt: text('prompt').notNull(),
  cultivationLevel: varchar('cultivation_level', { length: 50 }).notNull(),
  spiritRoot: varchar('spirit_root', { length: 50 }).notNull(),
  appearance: text('appearance'),
  backstory: text('backstory'),
  gender: varchar('gender', { length: 20 }),
  origin: varchar('origin', { length: 100 }),
  personality: text('personality'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// 战斗属性表
export const battleProfiles = pgTable('wanjiedaoyou_battle_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id)
    .notNull()
    .unique(),
  maxHp: integer('max_hp').notNull(),
  hp: integer('hp').notNull(),
  vitality: integer('vitality').notNull(),
  spirit: integer('spirit').notNull(),
  wisdom: integer('wisdom').notNull(),
  speed: integer('speed').notNull(),
  element: varchar('element', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// 技能表
export const skills = pgTable('wanjiedaoyou_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(), // attack, heal, control, buff
  power: integer('power').notNull(),
  element: varchar('element', { length: 20 }).notNull(),
  effects: jsonb('effects'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 装备表
export const equipment = pgTable('wanjiedaoyou_equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  bonus: jsonb('bonus'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 先天命格表
export const preHeavenFates = pgTable('wanjiedaoyou_pre_heaven_fates', {
  id: uuid('id').primaryKey().defaultRandom(),
  cultivatorId: uuid('cultivator_id')
    .references(() => cultivators.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 10 }).notNull(), // 吉, 凶
  effect: text('effect').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 活跃效果表
export const activeEffects = pgTable('wanjiedaoyou_active_effects', {
  id: uuid('id').primaryKey().defaultRandom(),
  battleProfileId: uuid('battle_profile_id')
    .references(() => battleProfiles.id)
    .notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  value: integer('value').notNull(),
  duration: integer('duration').notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 临时角色表 - 用于存放AI生成的角色结果，用户确认后保存到正式表
export const tempCultivators = pgTable('wanjiedaoyou_temp_cultivators', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(), // 关联到用户
  cultivatorData: jsonb('cultivator_data').notNull(), // 完整的角色数据，包含所有信息
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // 过期时间，在程序中设置
});
