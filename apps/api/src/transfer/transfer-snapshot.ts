import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import { TransferPackageHeaderSchema } from '@daoyou/contracts/transfer';
import { BeastLineupSchema } from '@daoyou/game-domain/beasts';
import { InventoryItemStructureSchema } from '@daoyou/game-domain/inventory';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { BeastSchema } from '@daoyou/game-rules/beasts/validation';
import { InventoryItemSchema } from '@daoyou/game-rules/inventory';
import { TRANSFER_STONE_LIMIT, transferableQuantity } from '@daoyou/game-rules/transfer';
import { validateManualStateV1 } from '@daoyou/game-rules/manuals/projection';
import { compileCurrentSectCombatV6 } from '@daoyou/game-rules/sects';
import type { SectCombatProgressV6 } from '@daoyou/game-domain/combat';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { z } from 'zod';

const nonnegative = z.number().int().min(0).max(2_147_483_647);

export const TransferSnapshotSchema = z.strictObject({
  header: TransferPackageHeaderSchema,
  role: z.strictObject({
    name: z.string().min(1).max(100),
    title: z.string().max(50).nullable(),
    gender: z.string().max(10).nullable(),
    origin: z.string().max(100).nullable(),
    personality: z.string().nullable(),
    background: z.string().nullable(),
    prompt: z.string().max(20_000),
    playerRace: z.string().max(32),
    raceNarrative: z.string().nullable(),
    realm: z.enum(REALM_VALUES),
    realmStage: z.enum(REALM_STAGE_VALUES),
    age: nonnegative,
    lifespan: nonnegative,
    closedDoorYearsTotal: nonnegative,
    attributes: z.strictObject({ vitality: nonnegative, strength: nonnegative, spirit: nonnegative, endurance: nonnegative, speed: nonnegative, willpower: nonnegative }),
    unallocatedAttributePoints: nonnegative,
    spiritStones: nonnegative.max(TRANSFER_STONE_LIMIT),
    cultivationProgress: z.record(z.string(), z.unknown()),
    condition: z.record(z.string(), z.unknown()),
  }),
  roots: z.array(z.strictObject({ element: z.string().max(10), strength: nonnegative.max(100), marrowWashBonus: nonnegative.max(100), grade: z.string().max(20).nullable() })).max(9),
  fates: z.array(z.strictObject({ name: z.string().min(1).max(100), quality: z.string().max(10).nullable(), details: z.unknown(), description: z.string().nullable() })).max(20),
  manuals: z.strictObject({ learned: z.array(z.strictObject({ manualId: z.string().max(160), level: nonnegative, unlockedLevel: nonnegative })).max(100), slots: z.array(z.strictObject({ slot: z.number().int().min(1).max(4), manualId: z.string().max(160) })).max(4) }),
  sect: z.strictObject({ sectId: z.string().max(64), methods: z.record(z.string(), nonnegative), activePathId: z.string().max(160), meridianDepth: z.number().int().min(0).max(7), loadouts: z.array(z.strictObject({ pathId: z.string().max(160), nodeIds: z.array(z.string().max(160)).max(7) })).max(2) }).nullable(),
  items: z.array(InventoryItemStructureSchema).max(14),
  equipped: z.array(z.strictObject({ slot: z.string().max(32), itemId: z.string().max(160) })).max(6),
  beasts: z.array(z.unknown()).max(8),
  lineup: BeastLineupSchema,
  beastStarterClaimed: z.boolean(),
  storyReceipts: z.array(z.strictObject({ track: z.string().max(32), storyId: z.string().max(80), beatId: z.string().max(80), status: z.string().max(20), acks: z.array(z.string()), grants: z.array(z.string()), marks: z.array(z.string()) })).max(100),
});

export type TransferSnapshot = z.infer<typeof TransferSnapshotSchema>;

export function validateTransferSnapshot(input: unknown): TransferSnapshot {
  const snapshot = TransferSnapshotSchema.parse(input);
  if (snapshot.role.playerRace !== 'human') throw new Error('目标服不支持此角色种族');
  if (snapshot.role.age > snapshot.role.lifespan) throw new Error('角色寿元状态无效');
  if (snapshot.items.filter((item) => item.location === 'bag').length > 8 || snapshot.items.some((item) => item.quantity !== transferableQuantity(item)))
    throw new Error('携带物品不符合转服上限');
  if (snapshot.items.some((item) => item.location === 'bag' && (item.slotIndex === null || item.slotIndex >= 8)) || snapshot.items.some((item) => item.location === 'storage'))
    throw new Error('转服包包含背包范围外的物品');
  for (const item of snapshot.items) InventoryItemSchema.parse(item);
  const itemIds = new Set(snapshot.items.map((item) => item.id));
  if (itemIds.size !== snapshot.items.length || new Set(snapshot.equipped.map((entry) => entry.slot)).size !== snapshot.equipped.length)
    throw new Error('转服物品或装备栏重复');
  for (const entry of snapshot.equipped) {
    const item = snapshot.items.find((candidate) => candidate.id === entry.itemId);
    if (!item || item.location !== 'equipped') throw new Error('穿戴栏引用无效');
  }
  if (snapshot.items.some((item) => item.location === 'equipped' && !snapshot.equipped.some((entry) => entry.itemId === item.id)))
    throw new Error('穿戴道装缺少装备栏');
  for (const beast of snapshot.beasts) BeastSchema.parse(beast);
  const beastIds = new Set(snapshot.beasts.map((beast) => BeastSchema.parse(beast).id));
  if (beastIds.size !== snapshot.beasts.length || snapshot.lineup.carriedBeastIds.length !== snapshot.beasts.length || snapshot.lineup.carriedBeastIds.some((beastId) => !beastIds.has(beastId)))
    throw new Error('灵兽袋编组与个体不一致');
  if (snapshot.sect && !(snapshot.sect.sectId in COMBAT_V6_SECT_DEFINITIONS)) throw new Error('目标服不支持原宗门');
  const manualDiagnostics = validateManualStateV1({
    version: 1, revision: 0, learned: snapshot.manuals.learned,
    build: { slots: snapshot.manuals.slots },
  } as Parameters<typeof validateManualStateV1>[0], snapshot.role.realm);
  if (manualDiagnostics.some((diagnostic) => diagnostic.severity === 'error'))
    throw new Error('原服功法数据不符合目标服规则');
  if (snapshot.sect?.activePathId) {
    const progress = {
      version: 1, sectId: snapshot.sect.sectId,
      methods: snapshot.sect.methods, activePathId: snapshot.sect.activePathId,
      meridianDepth: snapshot.sect.meridianDepth,
      meridianLoadouts: snapshot.sect.loadouts.map((loadout) => ({ ...loadout, revision: 0 })),
    } as SectCombatProgressV6;
    const compiled = compileCurrentSectCombatV6({ progress, characterLevel: getRealmStageLevel(snapshot.role.realm, snapshot.role.realmStage) });
    if (!compiled.ok) throw new Error('原服宗门修炼数据不符合目标服规则');
  }
  return snapshot;
}

export function transferPreview(snapshot: TransferSnapshot) {
  return {
    sourceServerId: snapshot.header.sourceServerId,
    sourceCultivatorId: snapshot.header.sourceCultivatorId,
    name: snapshot.role.name,
    realm: snapshot.role.realm,
    realmStage: snapshot.role.realmStage,
    spiritStones: snapshot.role.spiritStones,
    sectId: snapshot.sect?.sectId ?? null,
    manualCount: snapshot.manuals.learned.length,
    equippedCount: snapshot.equipped.length,
    items: snapshot.items.map((item) => ({ slot: item.slotIndex, definitionId: item.definitionId, quantity: item.quantity })),
    beastCount: snapshot.beasts.length,
  };
}
