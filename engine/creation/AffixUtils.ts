/**
 * 词条工具函数
 *
 * 提供词条相关的辅助功能：
 * - 词条查找
 * - 词条过滤
 * - 词条表格构建（用于AI提示词）
 * - 词条选择校验
 */

import type { EffectConfig } from '@/engine/effect/types';
import type { EquipmentSlot, Quality, RealmType } from '@/types/constants';
import { QUALITY_VALUES, REALM_VALUES } from '@/types/constants';
import { EffectMaterializer } from './EffectMaterializer';
import type { AffixWeight, MaterializationContext } from './types';

// ============================================================
// 词条查找
// ============================================================

/**
 * 根据ID查找词条
 */
export function findAffixById(
  pool: AffixWeight[],
  id: string,
): AffixWeight | undefined {
  return pool.find((affix) => affix.id === id);
}

/**
 * 根据ID列表批量查找词条
 */
export function findAffixesByIds(
  pool: AffixWeight[],
  ids: string[],
): AffixWeight[] {
  return ids
    .map((id) => findAffixById(pool, id))
    .filter((affix): affix is AffixWeight => affix !== undefined);
}

// ============================================================
// 词条过滤
// ============================================================

/**
 * 检查词条是否符合当前条件
 */
export function isAffixEligible(
  affix: AffixWeight,
  quality: Quality,
  slot?: EquipmentSlot,
  realm?: RealmType,
): boolean {
  const qualityIndex = QUALITY_VALUES.indexOf(quality);

  // 品质要求检查
  if (affix.minQuality) {
    const minIndex = QUALITY_VALUES.indexOf(affix.minQuality);
    if (qualityIndex < minIndex) return false;
  }
  if (affix.maxQuality) {
    const maxIndex = QUALITY_VALUES.indexOf(affix.maxQuality);
    if (qualityIndex > maxIndex) return false;
  }

  // 槽位检查
  if (slot && affix.slots && !affix.slots.includes(slot)) {
    return false;
  }

  return true;
}

/**
 * 过滤词条池，只保留符合条件的词条
 */
export function filterAffixPool(
  pool: AffixWeight[],
  quality: Quality,
  slot?: EquipmentSlot,
  realm?: RealmType,
): AffixWeight[] {
  return pool.filter((affix) => isAffixEligible(affix, quality, slot, realm));
}

// ============================================================
// 词条数量限制
// ============================================================

/**
 * 根据品质获取主词条数量
 */
export function getPrimaryAffixCount(quality: Quality): number {
  const qualityIndex = QUALITY_VALUES.indexOf(quality);
  // 地品及以上可以有2个主词条
  return qualityIndex >= QUALITY_VALUES.indexOf('地品') ? 2 : 1;
}

/**
 * 根据品质和境界获取最大副词条数量
 */
export function getMaxSecondaryAffixCount(
  quality: Quality,
  realm: RealmType,
): number {
  const qualityIndex = QUALITY_VALUES.indexOf(quality);
  const realmIndex = REALM_VALUES.indexOf(realm);

  // 品质限制
  const qualityLimit = Math.max(0, qualityIndex - 2); // 玄品开始有副词条

  // 境界限制
  let realmLimit = 0;
  if (realmIndex >= REALM_VALUES.indexOf('筑基')) realmLimit = 1;
  if (realmIndex >= REALM_VALUES.indexOf('金丹')) realmLimit = 2;
  if (realmIndex >= REALM_VALUES.indexOf('化神')) realmLimit = 3;
  if (realmIndex >= REALM_VALUES.indexOf('合体')) realmLimit = 4;

  return Math.min(qualityLimit, realmLimit, 5); // 最多5个副词条
}

// ============================================================
// 词条表格构建（用于AI提示词）
// ============================================================

/**
 * 构建词条表格（Markdown格式）
 */
export function buildAffixTable(
  affixes: AffixWeight[],
  options: {
    showSlots?: boolean;
    showQuality?: boolean;
  } = {},
): string {
  const { showSlots = true, showQuality = true } = options;

  // 构建表头
  const headers = ['ID', '名称', '描述'];
  if (showSlots) headers.push('槽位');
  if (showQuality) headers.push('品质要求');

  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `|${headers.map(() => '---').join('|')}|`;

  // 构建数据行
  const dataRows = affixes.map((affix) => {
    const cells = [affix.id, affix.displayName, affix.displayDescription];
    if (showSlots) {
      cells.push(affix.slots?.join('/') || '通用');
    }
    if (showQuality) {
      cells.push(affix.minQuality || '凡品');
    }
    return `| ${cells.join(' | ')} |`;
  });

  return [headerRow, separatorRow, ...dataRows].join('\n');
}

/**
 * 构建完整的词条选择提示词片段
 */
export function buildAffixSelectionPrompt(
  primaryPool: AffixWeight[],
  secondaryPool: AffixWeight[],
  primaryCount: { min: number; max: number },
  secondaryCount: { min: number; max: number },
  options: {
    showSlots?: boolean;
    showQuality?: boolean;
  } = {},
): string {
  const parts: string[] = [];

  // 主词条部分
  if (primaryPool.length > 0) {
    parts.push(
      `## 可选主词条 (必选${primaryCount.min}-${primaryCount.max}个)\n`,
    );
    parts.push(buildAffixTable(primaryPool, options));
    parts.push('');
  }

  // 副词条部分
  if (secondaryPool.length > 0 && secondaryCount.max > 0) {
    parts.push(
      `## 可选副词条 (可选${secondaryCount.min}-${secondaryCount.max}个)\n`,
    );
    parts.push(buildAffixTable(secondaryPool, options));
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================
// 词条选择校验
// ============================================================

export interface AffixValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 校验法宝词条选择
 */
export function validateArtifactAffixSelection(
  primaryIds: string[],
  secondaryIds: string[],
  primaryPool: AffixWeight[],
  secondaryPool: AffixWeight[],
  quality: Quality,
  slot: EquipmentSlot,
  realm: RealmType,
): AffixValidationResult {
  const errors: string[] = [];

  // 1. 检查主词条数量
  const expectedPrimaryCount = getPrimaryAffixCount(quality);
  if (primaryIds.length < 1) {
    errors.push('至少需要选择1个主词条');
  }
  if (primaryIds.length > expectedPrimaryCount) {
    errors.push(`当前品质最多选择${expectedPrimaryCount}个主词条`);
  }

  // 2. 检查副词条数量
  const maxSecondary = getMaxSecondaryAffixCount(quality, realm);
  if (secondaryIds.length > maxSecondary) {
    errors.push(`当前品质和境界最多选择${maxSecondary}个副词条`);
  }

  // 3. 检查主词条是否存在且合法
  for (const id of primaryIds) {
    const affix = findAffixById(primaryPool, id);
    if (!affix) {
      errors.push(`主词条ID "${id}" 不存在`);
      continue;
    }
    if (!isAffixEligible(affix, quality, slot, realm)) {
      errors.push(`主词条 "${affix.displayName}" 不符合当前品质或槽位要求`);
    }
  }

  // 4. 检查副词条是否存在且合法
  for (const id of secondaryIds) {
    const affix = findAffixById(secondaryPool, id);
    if (!affix) {
      errors.push(`副词条ID "${id}" 不存在`);
      continue;
    }
    if (!isAffixEligible(affix, quality, slot, realm)) {
      errors.push(`副词条 "${affix.displayName}" 不符合当前品质或槽位要求`);
    }
  }

  // 5. 检查是否有重复
  const allIds = [...primaryIds, ...secondaryIds];
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== allIds.length) {
    errors.push('词条选择中存在重复');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 校验丹药词条选择
 */
export function validateConsumableAffixSelection(
  primaryId: string,
  secondaryId: string | undefined,
  primaryPool: AffixWeight[],
  secondaryPool: AffixWeight[],
  quality: Quality,
): AffixValidationResult {
  const errors: string[] = [];

  // 1. 检查主词条
  const primaryAffix = findAffixById(primaryPool, primaryId);
  if (!primaryAffix) {
    errors.push(`主词条ID "${primaryId}" 不存在`);
  } else if (!isAffixEligible(primaryAffix, quality)) {
    errors.push(`主词条 "${primaryAffix.displayName}" 不符合当前品质要求`);
  }

  // 2. 检查副词条（如果有）
  if (secondaryId) {
    const secondaryAffix = findAffixById(secondaryPool, secondaryId);
    if (!secondaryAffix) {
      errors.push(`副词条ID "${secondaryId}" 不存在`);
    } else if (!isAffixEligible(secondaryAffix, quality)) {
      errors.push(`副词条 "${secondaryAffix.displayName}" 不符合当前品质要求`);
    }

    // 检查重复
    if (primaryId === secondaryId) {
      errors.push('主词条和副词条不能相同');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 校验神通词条选择
 */
export function validateSkillAffixSelection(
  primaryId: string,
  secondaryId: string | undefined,
  primaryPool: AffixWeight[],
  secondaryPool: AffixWeight[],
  quality: Quality,
): AffixValidationResult {
  const errors: string[] = [];

  // 1. 检查主词条
  const primaryAffix = findAffixById(primaryPool, primaryId);
  if (!primaryAffix) {
    errors.push(`主词条ID "${primaryId}" 不存在`);
  } else if (!isAffixEligible(primaryAffix, quality)) {
    errors.push(`主词条 "${primaryAffix.displayName}" 不符合当前品质要求`);
  }

  // 2. 检查副词条（如果有）
  if (secondaryId && secondaryPool.length > 0) {
    const secondaryAffix = findAffixById(secondaryPool, secondaryId);
    if (!secondaryAffix) {
      errors.push(`副词条ID "${secondaryId}" 不存在`);
    } else if (!isAffixEligible(secondaryAffix, quality)) {
      errors.push(`副词条 "${secondaryAffix.displayName}" 不符合当前品质要求`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 校验命格词条选择
 */
export function validateFateAffixSelection(
  affixIds: string[],
  pool: AffixWeight[],
  quality: Quality,
  expectedCount: number,
): AffixValidationResult {
  const errors: string[] = [];

  // 1. 检查数量
  if (affixIds.length < 1) {
    errors.push('至少需要选择1个词条');
  }
  if (affixIds.length > expectedCount) {
    errors.push(`当前品质最多选择${expectedCount}个词条`);
  }

  // 2. 检查词条是否存在且合法
  for (const id of affixIds) {
    const affix = findAffixById(pool, id);
    if (!affix) {
      errors.push(`词条ID "${id}" 不存在`);
      continue;
    }
    if (!isAffixEligible(affix, quality)) {
      errors.push(`词条 "${affix.displayName}" 不符合当前品质要求`);
    }
  }

  // 3. 检查是否有重复
  const uniqueIds = new Set(affixIds);
  if (uniqueIds.size !== affixIds.length) {
    errors.push('词条选择中存在重复');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================
// 词条数值化
// ============================================================

/**
 * 根据词条ID批量数值化
 */
export function materializeAffixesById(
  ids: string[],
  pool: AffixWeight[],
  context: MaterializationContext,
): EffectConfig[] {
  const affixes = findAffixesByIds(pool, ids);
  return EffectMaterializer.materializeAll(affixes, context);
}

/**
 * 获取选中词条的展示信息
 */
export function getSelectedAffixesInfo(
  ids: string[],
  pool: AffixWeight[],
): Array<{
  id: string;
  displayName: string;
  displayDescription: string;
}> {
  return ids
    .map((id) => {
      const affix = findAffixById(pool, id);
      if (!affix) return null;
      return {
        id: affix.id,
        displayName: affix.displayName,
        displayDescription: affix.displayDescription,
      };
    })
    .filter((info): info is NonNullable<typeof info> => info !== null);
}

// ============================================================
// 诅咒词条生成
// ============================================================

/**
 * 从诅咒词条池中随机生成诅咒效果（五行相克时调用）
 */
export function generateCurseAffix(
  cursePool: AffixWeight[],
  context: MaterializationContext,
): EffectConfig[] {
  if (cursePool.length === 0) return [];

  // 权重随机选取一个诅咒词条
  const totalWeight = cursePool.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const affix of cursePool) {
    random -= affix.weight;
    if (random <= 0) {
      return EffectMaterializer.materializeAll([affix], context);
    }
  }

  // 默认返回第一个
  return EffectMaterializer.materializeAll([cursePool[0]], context);
}
