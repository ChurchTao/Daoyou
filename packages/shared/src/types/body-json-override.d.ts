/* eslint-disable @typescript-eslint/no-explicit-any */
export {};

declare global {
  interface Body {
    json<T = any>(): Promise<T>;
  }
}
