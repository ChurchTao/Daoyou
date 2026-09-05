import { z } from 'zod';
import {
  ResourceScopeSchema,
  type ResourceScope,
  type ResourceScopeKind,
} from './core';
import {
  artifactSchema,
  consumableSchema,
  INVENTORY_RESOURCE_DATA_SCHEMAS,
  INVENTORY_RESOURCE_TOPICS,
  materialSchema,
  type InventoryResourceDataMap,
} from './inventory';
import {
  PLAYER_RESOURCE_DATA_SCHEMAS,
  PLAYER_RESOURCE_TOPICS,
  profileCultivatorSchema,
  taskInstanceSchema,
  type PlayerResourceDataMap,
} from './player';
import {
  SECT_RESOURCE_DATA_SCHEMAS,
  SECT_RESOURCE_TOPICS,
  sectTaskViewSchema,
  type SectResourceDataMap,
} from './sect';

/**
 * Resource protocol source of truth. A topic is deliberately mapped to one
 * data shape only; filtered or paginated views vary by cache params, not by
 * changing the topic payload.
 */
export interface ResourceDataMap
  extends
    PlayerResourceDataMap,
    SectResourceDataMap,
    InventoryResourceDataMap {}

export const RESOURCE_TOPICS = [
  ...PLAYER_RESOURCE_TOPICS,
  ...SECT_RESOURCE_TOPICS,
  ...INVENTORY_RESOURCE_TOPICS,
] as const satisfies readonly (keyof ResourceDataMap)[];

export const ResourceTopicSchema = z.enum(RESOURCE_TOPICS);
export type ResourceTopic = keyof ResourceDataMap;

export const RESOURCE_TOPIC_SCOPE_KIND = {
  'player.session': 'account',
  'player.profile': 'cultivator',
  'player.condition': 'cultivator',
  'player.progress': 'cultivator',
  'player.currency': 'cultivator',
  'player.loadout': 'cultivator',
  'player.combat-v6-build': 'cultivator',
  'player.mail-summary': 'cultivator',
  'player.task-summary': 'cultivator',
  'player.tasks': 'cultivator',
  'sect.membership': 'cultivator',
  'sect.members': 'sect',
  'sect.contribution-ranking': 'sect',
  'sect.infrastructure': 'sect',
  'sect.progression': 'cultivator',
  'sect.tasks': 'cultivator',
  'sect.shop': 'cultivator',
  'sect.construction-member': 'cultivator',
  'inventory.artifacts': 'cultivator',
  'inventory.materials': 'cultivator',
  'inventory.consumables': 'cultivator',
} as const satisfies Record<ResourceTopic, ResourceScopeKind>;

/** Runtime counterpart of ResourceDataMap, used at all network boundaries. */
export const RESOURCE_DATA_SCHEMAS = {
  ...PLAYER_RESOURCE_DATA_SCHEMAS,
  ...SECT_RESOURCE_DATA_SCHEMAS,
  ...INVENTORY_RESOURCE_DATA_SCHEMAS,
} satisfies {
  [TTopic in ResourceTopic]: z.ZodType<ResourceDataMap[TTopic]>;
};

function getResourceMergeSchema(topic: ResourceTopic): z.ZodTypeAny {
  if (topic === 'player.profile') {
    return z
      .object({
        cultivator: profileCultivatorSchema.partial().strict().optional(),
      })
      .strict();
  }
  const mergeableTopics = new Set<ResourceTopic>([
    'player.session',
    'player.currency',
    'player.mail-summary',
    'player.task-summary',
    'sect.membership',
    'sect.progression',
    'sect.construction-member',
  ]);
  if (!mergeableTopics.has(topic)) return z.never();
  const schema = RESOURCE_DATA_SCHEMAS[topic];
  if (!(schema instanceof z.ZodObject)) return z.never();
  return schema.partial().strict();
}

export type ResourceChangeOperation =
  'replace' | 'merge' | 'upsert-items' | 'remove-items' | 'invalidate';

type ResourceItem<T> = T extends readonly (infer TItem)[]
  ? TItem
  : T extends { items: readonly (infer TItem)[] }
    ? TItem
    : never;

export type PlayerProfilePatch = {
  cultivator?: Partial<ResourceDataMap['player.profile']['cultivator']>;
};

type MergeableResourceTopic =
  | 'player.session'
  | 'player.profile'
  | 'player.currency'
  | 'player.mail-summary'
  | 'player.task-summary'
  | 'sect.membership'
  | 'sect.progression'
  | 'sect.construction-member';

type ItemResourceTopic =
  | 'player.tasks'
  | 'sect.tasks'
  | 'inventory.artifacts'
  | 'inventory.materials'
  | 'inventory.consumables';

type ResourceMergePayload<TTopic extends MergeableResourceTopic> =
  TTopic extends 'player.profile'
    ? PlayerProfilePatch
    : ResourceDataMap[TTopic] extends object
      ? Partial<ResourceDataMap[TTopic]>
      : ResourceDataMap[TTopic];

type ResourceChangeOperationDescriptor<TTopic extends ResourceTopic> =
  | { operation: 'replace'; payload: ResourceDataMap[TTopic] }
  | { operation: 'invalidate' }
  | (TTopic extends MergeableResourceTopic
      ? {
          operation: 'merge';
          payload: ResourceMergePayload<TTopic>;
        }
      : never)
  | (TTopic extends ItemResourceTopic
      ? | {
            operation: 'upsert-items';
            payload: {
              items: ResourceItem<ResourceDataMap[TTopic]>[];
              idKey: string;
            };
          }
        | {
            operation: 'remove-items';
            payload: {
              ids: Array<string | number>;
              idKey: string;
            };
          }
      : never);

type ResourceChangeBase<TTopic extends ResourceTopic> = {
  id: string;
  mutationOrdinal: number;
  scope: ResourceScope;
  resourceTopic: TTopic;
  resourceVersion: number;
  scopeVersion: number;
  eventType: string;
  source: string;
  createdAt: string;
};

export type ResourceChange<TTopic extends ResourceTopic = ResourceTopic> =
  TTopic extends ResourceTopic
    ? ResourceChangeBase<TTopic> & ResourceChangeOperationDescriptor<TTopic>
    : never;

const ResourceChangeWireSchema = z
  .object({
    id: z.string().uuid(),
    mutationOrdinal: z.number().int().nonnegative(),
    scope: ResourceScopeSchema,
    resourceTopic: ResourceTopicSchema,
    resourceVersion: z.number().int().nonnegative(),
    scopeVersion: z.number().int().nonnegative(),
    eventType: z.string().min(1).max(96),
    source: z.string().min(1).max(96),
    createdAt: z.string(),
    operation: z.enum([
      'replace',
      'merge',
      'upsert-items',
      'remove-items',
      'invalidate',
    ]),
    payload: z.json().optional(),
  })
  .strict();
const resourceItemSchemas: Partial<Record<ResourceTopic, z.ZodTypeAny>> = {
  'player.tasks': taskInstanceSchema,
  'sect.tasks': sectTaskViewSchema,
  'inventory.artifacts': artifactSchema,
  'inventory.materials': materialSchema,
  'inventory.consumables': consumableSchema,
};

const MERGEABLE_RESOURCE_TOPICS = new Set<ResourceTopic>([
  'player.session',
  'player.profile',
  'player.currency',
  'player.mail-summary',
  'player.task-summary',
  'sect.membership',
  'sect.progression',
  'sect.construction-member',
]);

export const ResourceChangeSchema: z.ZodType<ResourceChange> =
  ResourceChangeWireSchema.superRefine((change, context) => {
    if (RESOURCE_TOPIC_SCOPE_KIND[change.resourceTopic] !== change.scope.kind) {
      context.addIssue({
        code: 'custom',
        path: ['scope', 'kind'],
        message: `topic ${change.resourceTopic} 不属于 ${change.scope.kind} scope`,
      });
    }
    const schema = RESOURCE_DATA_SCHEMAS[change.resourceTopic];
    const itemSchema = resourceItemSchemas[change.resourceTopic];
    const payloadSchema =
      change.operation === 'replace'
        ? schema
        : change.operation === 'merge'
          ? MERGEABLE_RESOURCE_TOPICS.has(change.resourceTopic)
            ? getResourceMergeSchema(change.resourceTopic)
            : z.never()
          : change.operation === 'upsert-items'
            ? itemSchema
              ? z.object({
                  items: z.array(itemSchema),
                  idKey: z.string().min(1).max(64).default('id'),
                })
              : z.never()
            : change.operation === 'remove-items'
              ? itemSchema
                ? z.object({
                    ids: z.array(z.union([z.string(), z.number()])),
                    idKey: z.string().min(1).max(64).default('id'),
                  })
                : z.never()
              : z.undefined();
    const parsed = payloadSchema.safeParse(change.payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({
          ...issue,
          path: ['payload', ...issue.path],
        });
      }
    }
  }) as z.ZodType<ResourceChange>;

type ResourceChangeDescriptorBase<TTopic extends ResourceTopic> = {
  scope?: ResourceScope;
  resourceTopic: TTopic;
  eventType: string;
};

export type ResourceChangeDescriptor<
  TTopic extends ResourceTopic = ResourceTopic,
> = TTopic extends ResourceTopic
  ? ResourceChangeDescriptorBase<TTopic> &
      ResourceChangeOperationDescriptor<TTopic>
  : never;
