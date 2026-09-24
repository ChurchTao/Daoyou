import { DAO_FORMATION_INSCRIPTIONS_V1 } from '../engine/combat-v6/equipment/content';
import { daoFormationMaxLevel } from '../engine/combat-v6/equipment/inscriptions';
import {
  BAG_CAPACITY,
  emptySlot,
  InventoryRuleError,
  itemDefinition,
  type InventoryItem,
  type ItemGrant,
} from '../inventory';
import { InventoryEquipmentSchema } from '../inventory/equipment';
import { inventoryStackIdentity } from '../inventory/stack-key';
import {
  INSCRIPTION_MAX_LEVEL,
  inscriptionItemId,
} from '../items/definitions/inscriptions';
import {
  MaterialFactsSchema,
  type MaterialFacts,
} from '../items/definitions/materials';
import type { Quality } from '../types/constants';

// 独立经济配置，不随坊市报价或材料描述变化。内部统一使用十分之一份。
const QUALITY_SHARES: Record<Quality, number> = {
  凡品: 1,
  灵品: 6,
  玄品: 20,
  真品: 60,
  地品: 200,
  天品: 1000,
  仙品: 4000,
  神品: 20000,
};
const TYPE_TENTHS = { ore: 10, monster: 12, aux: 15, tcdb: 25 } as const;
export type InscriptionRef = { id: string; revision: number };
export type InscriptionMaterialRef = InscriptionRef & { quantity: number };
export type InscriptionCost = { qi: number; spiritStones: number };

export function inscriptionMaterialTenths(facts: MaterialFacts): number {
  if (!(facts.type in TYPE_TENTHS))
    throw new InventoryRuleError('仅可投入矿石、妖兽材料、辅助材料和天材地宝');
  return (
    QUALITY_SHARES[facts.rank] *
    TYPE_TENTHS[facts.type as keyof typeof TYPE_TENTHS]
  );
}

export function inscriptionMaterialProblem(item: InventoryItem): string | null {
  if (item.location !== 'bag') return '请先将材料取入储物袋';
  if (item.definitionId !== 'material.v1') return '请选择绘阵材料';
  const parsed = MaterialFactsSchema.safeParse(item.instanceData);
  if (!parsed.success) return '材料事实无效';
  try {
    inscriptionMaterialTenths(parsed.data);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export function inscriptionLevelTenths(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > INSCRIPTION_MAX_LEVEL)
    throw new InventoryRuleError('阵纹等级须为1至11级');
  return 40 * 2 ** (level - 1);
}

export function previewInscriptionDraw(totalTenths: number) {
  if (!Number.isSafeInteger(totalTenths) || totalTenths < 40)
    throw new InventoryRuleError('至少需要4份材料');
  let remaining = totalTenths;
  const outputs: { level: number; quantity: number }[] = [];
  for (let level = INSCRIPTION_MAX_LEVEL; level >= 1; level--) {
    const required = inscriptionLevelTenths(level);
    const quantity = Math.floor(remaining / required);
    if (quantity) outputs.push({ level, quantity });
    remaining %= required;
    if (outputs.length === 3) break;
  }
  return {
    totalTenths,
    remainderTenths: remaining,
    outputs,
    cost: {
      qi: Math.min(100, Math.max(1, Math.ceil(totalTenths / 5120))),
      spiritStones: Math.ceil(totalTenths / 10),
    },
  };
}
export type InscriptionDrawPreview = ReturnType<typeof previewInscriptionDraw>;

function resolve(items: InventoryItem[], ref: InscriptionRef) {
  const item = items.find(
    (i) => i.id === ref.id && i.revision === ref.revision,
  );
  if (!item) throw new InventoryRuleError('物品已变化，请重新选择');
  return item;
}

function consume(items: InventoryItem[], refs: InscriptionMaterialRef[]) {
  if (new Set(refs.map((ref) => ref.id)).size !== refs.length)
    throw new InventoryRuleError('重复堆叠须合并数量');
  const quantities = new Map(
    refs.map((ref) => {
      const item = resolve(items, ref);
      if (
        item.location !== 'bag' ||
        !Number.isInteger(ref.quantity) ||
        ref.quantity < 1 ||
        item.quantity < ref.quantity
      )
        throw new InventoryRuleError('储物袋中的物品数量不足');
      return [ref.id, ref.quantity];
    }),
  );
  return items.flatMap((item) => {
    const used = quantities.get(item.id) ?? 0;
    return used === item.quantity
      ? []
      : [
          {
            ...item,
            quantity: item.quantity - used,
            revision: item.revision + Number(used > 0),
          },
        ];
  });
}

/** 在抽取类型前，预检所有可能分配的最大占格，避免满包选择性开奖。 */
export function requiredDrawSlots(
  items: InventoryItem[],
  outputs: InscriptionDrawPreview['outputs'],
) {
  return outputs.reduce((total, output) => {
    const activationCosts = DAO_FORMATION_INSCRIPTIONS_V1.map((pattern) => {
      const id = inscriptionItemId(pattern.id, output.level);
      const free = items
        .filter(
          (i) =>
            i.location === 'bag' &&
            i.definitionId === id &&
            i.stackKey === inventoryStackIdentity(id, null),
        )
        .reduce(
          (sum, i) => sum + itemDefinition(id).stackLimit - i.quantity,
          0,
        );
      return free + 1;
    }).sort((a, b) => a - b);
    let spent = 0;
    let maxSlots = 0;
    // 首个新格需填满该类型的已有堆叠；之后每99枚再占一个格。
    for (let k = 1; k <= activationCosts.length; k++) {
      spent += activationCosts[k - 1];
      if (spent <= output.quantity)
        maxSlots = Math.max(
          maxSlots,
          k + Math.floor((output.quantity - spent) / 99),
        );
    }
    return total + maxSlots;
  }, 0);
}

export function prepareInscriptionDraw(
  items: InventoryItem[],
  refs: InscriptionMaterialRef[],
) {
  if (refs.length < 1 || refs.length > 4)
    throw new InventoryRuleError('请选择一至四种材料');
  const afterMaterials = consume(items, refs);
  const totalTenths = refs.reduce((sum, ref) => {
    const item = resolve(items, ref);
    const problem = inscriptionMaterialProblem(item);
    if (problem) throw new InventoryRuleError(problem);
    return (
      sum +
      inscriptionMaterialTenths(MaterialFactsSchema.parse(item.instanceData)) *
        ref.quantity
    );
  }, 0);
  const preview = previewInscriptionDraw(totalTenths);
  const needed = requiredDrawSlots(afterMaterials, preview.outputs);
  const free =
    BAG_CAPACITY - afterMaterials.filter((i) => i.location === 'bag').length;
  if (needed > free)
    throw new InventoryRuleError(
      `消耗材料后需预留${needed}个空格，以容纳所有可能的阵纹产出`,
    );
  return { preview, afterMaterials };
}

export function rollInscriptionDraw(
  preview: InscriptionDrawPreview,
  random: () => number,
): ItemGrant[] {
  const grants = new Map<string, ItemGrant>();
  for (const output of preview.outputs) {
    for (let i = 0; i < output.quantity; i++) {
      const pattern =
        DAO_FORMATION_INSCRIPTIONS_V1[
          Math.floor(random() * DAO_FORMATION_INSCRIPTIONS_V1.length)
        ];
      const definitionId = inscriptionItemId(pattern.id, output.level);
      const grant = grants.get(definitionId) ?? { definitionId, quantity: 0 };
      grant.quantity++;
      grants.set(definitionId, grant);
    }
  }
  return [...grants.values()];
}

export function inscriptionOf(item: InventoryItem) {
  const def = itemDefinition(item.definitionId);
  if (def.kind !== 'inscription') throw new InventoryRuleError('请选择阵纹');
  return { patternId: def.patternId!, level: def.level! };
}

export function inscriptionStrengthenCost(
  targetLevel: number,
): InscriptionCost {
  inscriptionLevelTenths(targetLevel);
  if (targetLevel < 2) throw new InventoryRuleError('合成须提升阵纹等级');
  return { qi: 0, spiritStones: 10 * 2 ** (targetLevel - 2) };
}

export function prepareInscriptionStrengthen(
  items: InventoryItem[],
  refs: InscriptionMaterialRef[],
) {
  if (
    refs.length < 1 ||
    refs.length > 2 ||
    refs.reduce((sum, r) => sum + r.quantity, 0) !== 2
  )
    throw new InventoryRuleError('需要两枚同种同级阵纹');
  const afterMaterials = consume(items, refs);
  const first = inscriptionOf(resolve(items, refs[0]));
  if (
    refs.some((ref) => {
      const other = inscriptionOf(resolve(items, ref));
      return other.patternId !== first.patternId || other.level !== first.level;
    })
  )
    throw new InventoryRuleError('需要两枚同种同级阵纹');
  const level = first.level + 1;
  const cost = inscriptionStrengthenCost(level);
  const definitionId = inscriptionItemId(first.patternId, level);
  if (
    emptySlot(afterMaterials) === null &&
    !afterMaterials.some(
      (i) =>
        i.location === 'bag' &&
        i.definitionId === definitionId &&
        i.quantity < 99 &&
        i.stackKey === inventoryStackIdentity(definitionId, null),
    )
  )
    throw new InventoryRuleError('请腾出一个储物袋空位，以容纳合成后的阵纹');
  return { afterMaterials, cost, grant: { definitionId, quantity: 1 } };
}

export function prepareInscriptionEquipment(
  items: InventoryItem[],
  equipmentRef: InscriptionRef,
  socket: number,
  inscriptionRef: InscriptionRef,
  action: 'engrave' | 'strengthen_socket',
  replace: boolean,
) {
  if (socket !== 0 && socket !== 1)
    throw new InventoryRuleError('请选择有效阵纹孔位');
  const equipmentItem = resolve(items, equipmentRef);
  if (
    equipmentItem.definitionId !== 'equipment.v6' ||
    !['bag', 'equipped'].includes(equipmentItem.location)
  )
    throw new InventoryRuleError('请选择随身或已穿戴道装');
  const equipment = InventoryEquipmentSchema.parse(equipmentItem.instanceData);
  const incoming = inscriptionOf(resolve(items, inscriptionRef));
  const old = equipment.formationInscriptions[socket];
  let next = incoming;
  let cost: InscriptionCost = { qi: 0, spiritStones: 0 };
  if (action === 'strengthen_socket') {
    if (
      !old ||
      old.patternId !== incoming.patternId ||
      old.level !== incoming.level
    )
      throw new InventoryRuleError('孔内合成需要一枚同种同级阵纹');
    next = { ...old, level: old.level + 1 };
    cost = inscriptionStrengthenCost(next.level);
  } else if (old && !replace)
    throw new InventoryRuleError('请确认覆盖，旧阵纹不会返还');
  if (next.level > daoFormationMaxLevel(equipment.equipmentLevel))
    throw new InventoryRuleError('阵纹等级超过该装备每孔上限');
  const pattern = DAO_FORMATION_INSCRIPTIONS_V1.find(
    (p) => p.id === next.patternId,
  )!;
  if (!pattern.allowedSlots.includes(equipment.slot))
    throw new InventoryRuleError('该阵纹不能烙印于此部位');
  equipment.formationInscriptions[socket] = next;
  const validated = InventoryEquipmentSchema.parse(equipment);
  const after = consume(items, [{ ...inscriptionRef, quantity: 1 }]).map(
    (item) =>
      item.id === equipmentItem.id
        ? { ...item, instanceData: validated, revision: item.revision + 1 }
        : item,
  );
  return {
    after,
    cost,
    equipmentId: equipmentItem.id,
    equipped: equipmentItem.location === 'equipped',
  };
}
