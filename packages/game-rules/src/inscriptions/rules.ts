import {
  QUALITY_SHARES,
  TYPE_TENTHS,
} from '@daoyou/game-content/inscriptions/config';
import type {
  InscriptionRef,
  InscriptionMaterialRef,
  InscriptionCost,
  InscriptionDrawPreview,
} from '@daoyou/game-domain/inscriptions';
import {
  MAX_CRAFT_MATERIAL_QUANTITY,
  InventoryRuleError,
  type InventoryItem,
  type ItemGrant,
  MaterialFactsSchema,
  type MaterialFacts,
} from '@daoyou/game-domain/inventory';

import { DAO_FORMATION_INSCRIPTIONS_V1 } from '@daoyou/game-content/equipment/base';

import { daoFormationMaxLevel } from '../equipment/inscriptions.js';



import { itemDefinition } from '../inventory/index.js';

import { InventoryEquipmentSchema } from '../inventory/equipment.js';

import {
  INSCRIPTION_DRAW_MAX_LEVEL,
  INSCRIPTION_MAX_LEVEL,
  inscriptionItemId,
} from '@daoyou/game-content/items/inscriptions';


export function inscriptionMaterialTenths(facts: MaterialFacts): number {
  if (!(facts.type in TYPE_TENTHS))
    throw new InventoryRuleError('仅可投入矿石、妖兽材料、辅助材料和天材地宝');
  return (
    QUALITY_SHARES[facts.rank] *
    TYPE_TENTHS[facts.type as keyof typeof TYPE_TENTHS]
  );
}

export function inscriptionMaterialProblem(item: InventoryItem): string | null {
  if (item.location !== 'bag' && item.location !== 'storage')
    return '请选择储物袋或储藏室中的材料';
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
    throw new InventoryRuleError(`阵纹等级须为1至${INSCRIPTION_MAX_LEVEL}级`);
  return 40 * 3 ** (level - 1);
}

/** 四件神品天材地宝 = 2_000_000 份 = 20_000_000 个十分位，开方后正好 30 点，之后不再截断。 */
const INSCRIPTION_DRAW_QI_REFERENCE_TENTHS = 20_000_000;
const INSCRIPTION_DRAW_QI_AT_REFERENCE = 30;

function inscriptionDrawQi(totalTenths: number) {
  const reference = INSCRIPTION_DRAW_QI_REFERENCE_TENTHS;
  const at = INSCRIPTION_DRAW_QI_AT_REFERENCE;
  let qi = Math.ceil(at * Math.sqrt(totalTenths / reference));
  if (!Number.isFinite(qi) || qi < 1) qi = 1;
  const scale = at * at;
  while (qi > 1 && (qi - 1) * (qi - 1) * reference >= totalTenths * scale)
    qi -= 1;
  while (qi * qi * reference < totalTenths * scale) qi += 1;
  return qi;
}

/** 按份数开方，最少 1。 */
function inscriptionDrawSpiritStones(totalTenths: number) {
  let stones = Math.ceil(Math.sqrt(totalTenths / 10));
  if (!Number.isFinite(stones) || stones < 1) stones = 1;
  while (stones > 1 && (stones - 1) * (stones - 1) * 10 >= totalTenths)
    stones -= 1;
  while (stones * stones * 10 < totalTenths) stones += 1;
  return stones;
}

export function previewInscriptionDraw(
  totalTenths: number,
): InscriptionDrawPreview {
  if (!Number.isSafeInteger(totalTenths) || totalTenths < 40)
    throw new InventoryRuleError('至少需要4份材料');
  let remaining = totalTenths;
  const outputs: { level: number; quantity: number }[] = [];
  for (let level = INSCRIPTION_DRAW_MAX_LEVEL; level >= 1; level--) {
    const required = inscriptionLevelTenths(level);
    const quantity = Math.floor(remaining / required);
    if (quantity) outputs.push({ level, quantity });
    remaining %= required;
    // 只留主产物和副产物两个等级，其余份数溢散。
    if (outputs.length === 2) break;
  }
  return {
    totalTenths,
    remainderTenths: remaining,
    outputs,
    cost: {
      qi: inscriptionDrawQi(totalTenths),
      spiritStones: inscriptionDrawSpiritStones(totalTenths),
    },
  };
}

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
        (item.location !== 'bag' && item.location !== 'storage') ||
        !Number.isInteger(ref.quantity) ||
        ref.quantity < 1 ||
        item.quantity < ref.quantity
      )
        throw new InventoryRuleError('所选位置的物品数量不足');
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
    const facts = MaterialFactsSchema.parse(item.instanceData);
    if (
      !Number.isInteger(ref.quantity) ||
      ref.quantity < 1 ||
      ref.quantity > MAX_CRAFT_MATERIAL_QUANTITY
    )
      throw new InventoryRuleError(
        `每个材料格最多投入 ${MAX_CRAFT_MATERIAL_QUANTITY} 份`,
      );
    return sum + inscriptionMaterialTenths(facts) * ref.quantity;
  }, 0);
  const preview = previewInscriptionDraw(totalTenths);
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
  return { qi: 0, spiritStones: 8 * 2 ** (targetLevel - 2) };
}

export const MAX_INSCRIPTION_STRENGTHEN_TIMES = 15;

export function prepareInscriptionStrengthen(
  items: InventoryItem[],
  refs: InscriptionMaterialRef[],
) {
  const total = refs.reduce((sum, ref) => sum + ref.quantity, 0);
  const times = total / 2;
  if (
    refs.length < 1 ||
    refs.length > 2 ||
    total < 2 ||
    total % 2 !== 0 ||
    times > MAX_INSCRIPTION_STRENGTHEN_TIMES
  )
    throw new InventoryRuleError(
      times > MAX_INSCRIPTION_STRENGTHEN_TIMES
        ? `单次最多合成${MAX_INSCRIPTION_STRENGTHEN_TIMES}次`
        : '需要两枚同种同级阵纹',
    );
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
  return {
    afterMaterials,
    cost: { qi: 0, spiritStones: cost.spiritStones * times },
    grant: { definitionId, quantity: times },
  };
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
    !['bag', 'storage', 'equipped'].includes(equipmentItem.location)
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

export type InscriptionSocketStep = {
  socket: 0 | 1;
  inscription: InscriptionRef;
  action: 'engrave' | 'strengthen_socket';
  replace: boolean;
};

export function prepareInscriptionSockets(
  items: InventoryItem[],
  equipmentRef: InscriptionRef,
  steps: InscriptionSocketStep[],
) {
  if (steps.length < 1 || steps.length > 2)
    throw new InventoryRuleError('请选择一至两个孔位');
  if (new Set(steps.map((step) => step.socket)).size !== steps.length)
    throw new InventoryRuleError('同一孔位不能重复烙印');
  resolve(items, equipmentRef);
  for (const step of steps) resolve(items, step.inscription);
  let current = items;
  let cost: InscriptionCost = { qi: 0, spiritStones: 0 };
  let equipped = false;
  let equipmentId = equipmentRef.id;
  for (const step of steps) {
    const equipment = current.find((item) => item.id === equipmentRef.id);
    const inscription = current.find((item) => item.id === step.inscription.id);
    if (!equipment || !inscription)
      throw new InventoryRuleError('物品已变化，请重新选择');
    const plan = prepareInscriptionEquipment(
      current,
      { id: equipment.id, revision: equipment.revision },
      step.socket,
      { id: inscription.id, revision: inscription.revision },
      step.action,
      step.replace,
    );
    current = plan.after;
    cost = {
      qi: cost.qi + plan.cost.qi,
      spiritStones: cost.spiritStones + plan.cost.spiritStones,
    };
    equipped = equipped || plan.equipped;
    equipmentId = plan.equipmentId;
  }
  return { after: current, cost, equipmentId, equipped };
}
