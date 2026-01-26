/**
 * Enemy Generator Schemas
 *
 * Zod schemas for AI-generated enemy blueprints.
 * AI generates creative content (names, descriptions, affix selections),
 * while the system calculates all numerical values.
 */

import { z } from 'zod';

/**
 * Enemy Blueprint Schema - AI only generates creative descriptions and affix selections
 * The system calculates all numerical values based on difficulty and realm.
 */
export const EnemyBlueprintSchema = z.object({
  // Basic Information
  name: z.string().describe('Enemy name'),
  title: z.string().optional().describe('Title, e.g., "烈火老祖"'),
  gender: z.enum(['男', '女']).describe('Gender'),
  description: z.string().describe('Appearance or aura description'),

  // Spiritual Roots - only describe elements, strength is calculated by algorithm
  spiritual_roots: z
    .array(
      z.object({
        element: z
          .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
          .describe('Element'),
      }),
    )
    .min(1)
    .max(3)
    .describe('1-3 spiritual roots'),

  // Skill Blueprints - AI selects affix IDs from affix pools
  skill_blueprints: z
    .array(
      z.object({
        name: z.string().describe('Skill name'),
        type: z.enum(['attack', 'heal', 'control', 'debuff', 'buff']),
        element: z
          .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
          .describe('Element'),
        // Primary affix ID selected from affix pool
        primary_affix_id: z
          .string()
          .describe('Primary affix ID, e.g., skill_attack_base_damage'),
        // Optional secondary affix IDs selected from affix pool
        secondary_affix_ids: z
          .array(z.string())
          .optional()
          .describe('Secondary affix ID array'),
      }),
    )
    .min(2)
    .max(4)
    .describe('2-4 skills'),

  // Equipment (optional)
  equipped_weapon_name: z
    .string()
    .optional()
    .describe('Artifact name for equipped weapon'),
});

export type EnemyBlueprint = z.infer<typeof EnemyBlueprintSchema>;
