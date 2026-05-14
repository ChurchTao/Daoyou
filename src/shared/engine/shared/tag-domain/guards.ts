const CREATION_TAG_PREFIXES = [
  'Material.',
  'Intent.',
  'Recipe.',
  'Energy.',
  'Affix.',
  'Outcome.',
] as const;

const RUNTIME_TAG_PREFIXES = [
  'Unit.',
  'Status.',
  'Ability.',
  'Buff.',
  'Trait.',
  'Condition.',
] as const;

function hasAnyPrefix(value: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => value.startsWith(prefix));
}

export function isCreationTag(tag: string): boolean {
  return hasAnyPrefix(tag, CREATION_TAG_PREFIXES);
}

export function isRuntimeTag(tag: string): boolean {
  return hasAnyPrefix(tag, RUNTIME_TAG_PREFIXES);
}

export function assertCreationTag(tag: string, context?: string): void {
  if (!isCreationTag(tag)) {
    throw new Error(
      context
        ? `${context}: invalid creation tag ${tag}`
        : `invalid creation tag ${tag}`,
    );
  }
}

export function assertRuntimeTag(tag: string, context?: string): void {
  if (!isRuntimeTag(tag)) {
    throw new Error(
      context
        ? `${context}: invalid runtime tag ${tag}`
        : `invalid runtime tag ${tag}`,
    );
  }
}

export function assertRuntimeTagInNamespaces(
  tag: string,
  namespaces: readonly string[],
  context?: string,
): void {
  assertRuntimeTag(tag, context);

  if (!namespaces.some((namespace) => tag.startsWith(namespace))) {
    throw new Error(
      context
        ? `${context}: invalid runtime tag namespace ${tag}`
        : `invalid runtime tag namespace ${tag}`,
    );
  }
}

export function assertRuntimeTagsInNamespaces(
  tags: readonly string[],
  namespaces: readonly string[],
  context?: string,
): void {
  tags.forEach((tag) => assertRuntimeTagInNamespaces(tag, namespaces, context));
}

export const TagDomainCatalog = {
  creationPrefixes: CREATION_TAG_PREFIXES,
  runtimePrefixes: RUNTIME_TAG_PREFIXES,
} as const;
