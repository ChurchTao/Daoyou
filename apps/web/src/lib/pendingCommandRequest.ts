/** Keep the same operation key until its committed result is received. */
export function pendingCommandRequest(
  owner: string,
  action: string,
  payload: unknown = null,
) {
  const key = `pending-command:${owner}:${action}:${JSON.stringify(payload)}`;
  const requestId = window.sessionStorage.getItem(key) ?? crypto.randomUUID();
  window.sessionStorage.setItem(key, requestId);
  return {
    requestId,
    complete() {
      if (window.sessionStorage.getItem(key) === requestId)
        window.sessionStorage.removeItem(key);
    },
  };
}

export function hasPendingCommandRequest(owner: string, action: string) {
  return (
    window.sessionStorage.getItem(`pending-command:${owner}:${action}:null`) !==
    null
  );
}
