/// <reference types="vite/client" />

declare const __APP_BUILD_ID__: string;

declare module '*.ttf?subsets' {
  export const css: { family: string };
  export const fontFamilyFallback: string;
}
