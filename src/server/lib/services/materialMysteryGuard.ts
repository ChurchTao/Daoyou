const MYSTERY_MATERIAL_BLOCKING_REASON = '待鉴定材料无法入炉，请先鉴定。';

type MaterialLike = {
  details?: unknown;
};

export function isMysteryMaterialRow(material: MaterialLike): boolean {
  const details = material.details;
  return !!details && typeof details === 'object' && 'mystery' in details;
}

export function getMysteryMaterialBlockingReason(
  materials: MaterialLike[],
): string | null {
  return materials.some(isMysteryMaterialRow)
    ? MYSTERY_MATERIAL_BLOCKING_REASON
    : null;
}

export function assertNoMysteryMaterialRows(materials: MaterialLike[]): void {
  const reason = getMysteryMaterialBlockingReason(materials);
  if (reason) {
    throw new Error(reason);
  }
}

export { MYSTERY_MATERIAL_BLOCKING_REASON };
