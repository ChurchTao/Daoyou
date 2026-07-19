export interface SectQueryRun<T> {
  key: string;
  loader(signal: AbortSignal): Promise<T>;
  force?: boolean;
  onStart(): void;
  onSuccess(data: T): void;
  onError(error: string): void;
}

/** Request-level coordinator; React state remains owned by SectQueryProvider. */
export class SectQueryCoordinator {
  private readonly controllers = new Map<string, AbortController>();
  private readonly requests = new Map<string, Promise<unknown>>();

  execute<T>(run: SectQueryRun<T>): Promise<T | undefined> {
    const existing = this.requests.get(run.key);
    if (existing && !run.force) return existing as Promise<T | undefined>;
    if (run.force) this.controllers.get(run.key)?.abort();

    const controller = new AbortController();
    this.controllers.set(run.key, controller);
    run.onStart();
    const request = run
      .loader(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) run.onSuccess(data);
        return controller.signal.aborted ? undefined : data;
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          run.onError(reason instanceof Error ? reason.message : '宗门卷宗读取失败');
        return undefined;
      })
      .finally(() => {
        if (this.controllers.get(run.key) === controller) {
          this.controllers.delete(run.key);
          this.requests.delete(run.key);
        }
      });
    this.requests.set(run.key, request);
    return request;
  }

  dispose(): void {
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.requests.clear();
  }
}
