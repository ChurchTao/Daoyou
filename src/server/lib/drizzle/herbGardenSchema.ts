import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { cultivators } from './schema';

export const herbGardenProfiles = pgTable(
  'wanjiedaoyou_herb_garden_profiles',
  {
    cultivatorId: uuid('cultivator_id')
      .primaryKey()
      .references(() => cultivators.id, { onDelete: 'cascade' }),
    totalHarvests: integer('total_harvests').notNull().default(0),
    totalVisits: integer('total_visits').notNull().default(0),
    initializedAt: timestamp('initialized_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const herbGardenPlots = pgTable(
  'wanjiedaoyou_herb_garden_plots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cultivatorId: uuid('cultivator_id')
      .notNull()
      .references(() => cultivators.id, { onDelete: 'cascade' }),
    slot: integer('slot').notNull(),
    herbKey: varchar('herb_key', { length: 64 }).notNull(),
    seedQuality: varchar('seed_quality', { length: 16 }).notNull(),
    plantedAt: timestamp('planted_at').notNull().defaultNow(),
    readyAt: timestamp('ready_at').notNull(),
    baseYield: integer('base_yield').notNull(),
    remainingYield: integer('remaining_yield').notNull(),
    stealLimit: integer('steal_limit').notNull().default(0),
    stolenCount: integer('stolen_count').notNull().default(0),
    mutationChance: doublePrecision('mutation_chance').notNull().default(0),
    mutationRank: varchar('mutation_rank', { length: 20 }),
    seedReturnChance: doublePrecision('seed_return_chance').notNull().default(0),
    modifierSnapshot: jsonb('modifier_snapshot').notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('herb_garden_plots_owner_slot_uidx').on(
      table.cultivatorId,
      table.slot,
    ),
    index('herb_garden_plots_owner_ready_idx').on(
      table.cultivatorId,
      table.readyAt,
    ),
  ],
);

export const herbGardenInteractions = pgTable(
  'wanjiedaoyou_herb_garden_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    plotId: uuid('plot_id'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => cultivators.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => cultivators.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 16 }).notNull(),
    herbKey: varchar('herb_key', { length: 64 }).notNull(),
    payload: jsonb('payload').notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('herb_garden_interactions_plot_actor_action_uidx')
      .on(table.plotId, table.actorId, table.action)
      .where(sql`${table.plotId} is not null`),
    index('herb_garden_interactions_owner_created_idx').on(
      table.ownerId,
      table.createdAt,
    ),
    index('herb_garden_interactions_actor_created_idx').on(
      table.actorId,
      table.createdAt,
    ),
  ],
);
