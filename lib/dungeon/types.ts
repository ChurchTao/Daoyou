import { z } from 'zod';

// === AI Interaction Schemas ===

const COST_TYPES_VALUES = [
  'weak',
  'artifact_damage',
  'material_loss',
  'spirit_stones_loss',
  'hp_loss',
  'mp_loss',
  'exp_loss',
  'lifespan_loss',
  'battle',
] as const;

export const COST_TYPES = [
  { type: 'weak', name: '陷入虚弱(value影响虚弱百分比)' },
  { type: 'artifact_damage', name: '法宝损坏' },
  { type: 'material_loss', name: '材料损耗' },
  { type: 'spirit_stones_loss', name: '灵石损耗' },
  { type: 'hp_loss', name: '气血损耗' },
  { type: 'mp_loss', name: '灵力损耗' },
  { type: 'exp_loss', name: '修为损耗' },
  { type: 'lifespan_loss', name: '寿元损耗' },
  { type: 'battle', name: '遭遇战斗' },
] as const;

// Resource Types
export const ResourceTypeEnum = z.enum(COST_TYPES_VALUES);

export const ResourceChangeSchema = z.object({
  type: ResourceTypeEnum,
  value: z.number(), // Positive = gain, Negative = loss (for settlement), Positive = cost (for options usually)
  desc: z.string().optional(), // Description for UI e.g. "损耗寿元10年"
});

// Option provided by AI
export const DungeonOptionSchema = z.object({
  id: z.number(),
  text: z.string(), // Display text for the user
  content: z.string().optional(), // Internal note or expanded description
  risk_level: z.enum(['low', 'medium', 'high']),
  requirement: z.string().optional(), // e.g. "Fire Spirit Root", "Sword Attribute"
  potential_cost: z.string().optional(), // Legacy text description
  costs: z.array(ResourceChangeSchema).optional(), // Structured costs
});

// Response from AI for each round
export const DungeonRoundSchema = z.object({
  scene_description: z.string(),
  interaction: z.object({
    options: z.array(DungeonOptionSchema),
  }),
  status_update: z.object({
    is_final_round: z.boolean(),
    internal_danger_score: z.number(),
  }),
});

// Settlement info from AI
export const DungeonSettlementSchema = z.object({
  ending_narrative: z.string(),
  settlement: z.object({
    reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']),
    potential_items: z.array(z.string()), // Flavor text for items

    // Structured gains/losses
    gains: z.array(ResourceChangeSchema).optional(),
    losses: z.array(ResourceChangeSchema).optional(),

    // Legacy support (optional, can be removed if prompt is perfect, but keeping for safety)
    resource_loss: z
      .object({
        durability_loss: z.number().optional(),
        spirit_stones: z.number().optional(),
        health_loss: z.number().optional(),
      })
      .optional(),
  }),
});

export const PlayerInfoSchema = z.object({
  name: z.string(),
  realm: z.string(),
  gender: z.string(),
  age: z.number(),
  lifespan: z.number(),
  personality: z.string(),
  attributes: z.object({
    vitality: z.number(),
    spirit: z.number(),
    wisdom: z.number(),
    speed: z.number(),
    willpower: z.number(),
  }),
  spiritual_roots: z.array(z.string()),
  fates: z.array(z.string()),
  cultivations: z.array(z.string()),
  skills: z.array(z.string()),
  spirit_stones: z.number(),
  background: z.string(),
  inventory: z.object({
    artifacts: z.array(z.string()),
    materials: z.array(z.string()),
  }),
});

export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
export type DungeonOption = z.infer<typeof DungeonOptionSchema>;
export type DungeonRound = z.infer<typeof DungeonRoundSchema>;
export type DungeonSettlement = z.infer<typeof DungeonSettlementSchema>;

// === Internal State Management ===

export interface DungeonState {
  cultivatorId: string;
  playerInfo: PlayerInfo;
  theme: string;
  currentRound: number;
  maxRounds: number;
  history: {
    round: number;
    scene: string;
    choice?: string;
    outcome?: string; // Narrative outcome of the choice? (maybe next scene covers this)
  }[];
  dangerScore: number;
  isFinished: boolean;
  currentOptions?: DungeonOption[]; // Store active options to validate choice and process costs
  settlement?: DungeonSettlement;
}
