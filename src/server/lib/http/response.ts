export function json(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}

export function runDetached(task: () => Promise<void> | void): void {
  queueMicrotask(() => {
    void Promise.resolve()
      .then(task)
      .catch((error) => {
        console.error('[runDetached] task failed:', error);
      });
  });
}
