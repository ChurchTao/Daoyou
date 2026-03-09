export {};

declare global {
  interface Body {
    json<T = unknown>(): Promise<T>;
  }
}
