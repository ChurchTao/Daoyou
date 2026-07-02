export function getAttributeDetailActionLabel(
  hasUnallocatedAttributePoints: boolean,
): string {
  return hasUnallocatedAttributePoints ? '去分配属性' : '详情';
}
