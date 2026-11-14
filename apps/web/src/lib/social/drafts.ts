const PREFIXES = ['direct-draft:v1:', 'direct-pending:v1:'];

export function readDirectChatStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeDirectChatStorage(
  key: string,
  value: string | null,
): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* A blocked or full storage must not prevent sending a message. */
  }
}

export function clearDirectChatStorage(
  storage: Pick<Storage, 'removeItem'> &
    Partial<Pick<Storage, 'length' | 'key'>> = window.sessionStorage,
): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < (storage.length ?? 0); index += 1) {
      const key = storage.key?.(index);
      if (key && PREFIXES.some((prefix) => key.startsWith(prefix)))
        keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    /* Inaccessible storage has no readable draft to expose. */
  }
}
