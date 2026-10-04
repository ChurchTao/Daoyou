import { z } from 'zod';
import {
  ItemLibraryItemIdSchema,
  ItemLibraryStatusSchema,
  ItemLibraryTypeSchema,
  ItemLibraryMaterialPayloadSchema,
  ArtifactEditorConfigSchema,
} from '@daoyou/game-domain/items/catalog';
import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import {
  MATERIAL_TYPE_VALUES,
  MaterialFactsSchema,
  INVENTORY_MATERIAL_TYPES,
  seedFactsOf,
} from '@daoyou/game-domain/inventory';

export const ArtifactPreviewRequestSchema = ArtifactEditorConfigSchema.extend({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
});

// Legacy entry/attachment schemas above are retained only for historical reads.
export const CreateItemLibraryEntrySchema = z.object({
  itemId: ItemLibraryItemIdSchema,
  type: z.literal('material'),
  status: ItemLibraryStatusSchema.default('published'),
  payload: ItemLibraryMaterialPayloadSchema.superRefine((payload, ctx) => {
    try {
      if (payload.type === 'seed') seedFactsOf(payload);
      else
        MaterialFactsSchema.parse({
          name: payload.name,
          type: payload.type,
          rank: payload.rank,
          element: payload.element ?? null,
          description: payload.description ?? '',
        });
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: '仅支持新版材料或具有完整生长事实的灵种',
      });
    }
  }),
  editorConfig: z.record(z.string(), z.unknown()).default({}),
});

export const UpdateItemLibraryEntrySchema = CreateItemLibraryEntrySchema.omit({
  itemId: true,
});

export const ItemLibraryListQuerySchema = z.object({
  status: ItemLibraryStatusSchema.optional(),
  type: ItemLibraryTypeSchema.optional(),
  materialType: z.enum(MATERIAL_TYPE_VALUES).optional(),
  quality: z.enum(QUALITY_VALUES).optional(),
  q: z.string().trim().max(100).optional(),
  itemIds: z.string().trim().max(4000).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const ItemLibraryMaterialGenerateSchema = z.object({
  count: z.number().int().min(1).max(200),
  materialType: z.enum([...INVENTORY_MATERIAL_TYPES, 'seed']),
  quality: z.enum(QUALITY_VALUES),
  status: ItemLibraryStatusSchema.default('published'),
  seed: z.string().trim().min(1).max(120).optional(),
});

export const ItemLibrarySpiritSeedGenerateSchema = z.object({
  count: z.number().int().min(1).max(50),
  quality: z.enum(QUALITY_VALUES),
  element: z.enum(ELEMENT_VALUES).optional(),
  status: ItemLibraryStatusSchema.default('published'),
});

export type CreateItemLibraryEntry = z.infer<
  typeof CreateItemLibraryEntrySchema
>;

export type UpdateItemLibraryEntry = z.infer<
  typeof UpdateItemLibraryEntrySchema
>;

export type ItemLibraryListQuery = z.infer<typeof ItemLibraryListQuerySchema>;

export type ItemLibraryMaterialGenerateInput = z.infer<
  typeof ItemLibraryMaterialGenerateSchema
>;

export type ItemLibrarySpiritSeedGenerateInput = z.infer<
  typeof ItemLibrarySpiritSeedGenerateSchema
>;
