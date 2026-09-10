/** Historical facts remain readable; this guard is only for new production. */
export function isRetiredDrawItem(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as {
    type?: unknown;
    spec?: { kind?: unknown; scenario?: unknown };
  };
  return (
    item.type === 'gongfa_manual' ||
    item.type === 'skill_manual' ||
    (item.spec?.kind === 'talisman' &&
      (item.spec.scenario === 'draw_gongfa' ||
        item.spec.scenario === 'draw_skill'))
  );
}

export function assertCurrentRewardItem(value: unknown): void {
  if (isRetiredDrawItem(value))
    throw new Error('旧版抽取已停用，不能新增专属符箓或秘籍');
}
