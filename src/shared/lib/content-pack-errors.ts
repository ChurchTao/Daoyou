type PackIssue = { path: readonly PropertyKey[]; message: string };

/** Locate invalid authored entries without parsing or changing the rejected data. */
export function formatContentPackErrors(
  file: string,
  data: unknown,
  issues: readonly PackIssue[],
): string {
  return issues.map((issue) => {
    const identities = new Set<string>();
    let current = data;
    for (const key of [...issue.path, undefined]) {
      if (current === null || typeof current !== 'object') break;
      const record = current as Record<PropertyKey, unknown>;
      if (typeof record.id === 'string') identities.add(record.id);
      else if (typeof record.rewardId === 'string') identities.add(record.rewardId);
      else if (typeof record.realm === 'string') identities.add(record.realm);
      else if (typeof record.floor === 'number') identities.add(`floor:${record.floor}`);
      if (key === undefined) break;
      current = record[key];
    }
    const context = identities.size ? ` [${[...identities].join(' / ')}]` : '';
    const path = issue.path.map(String).join('.') || '$';
    return `${file}: ${path}${context}: ${issue.message}`;
  }).join('\n');
}
