export {};

declare global {
  interface Body {
    json<T = any>(): Promise<T>;
  }
}
