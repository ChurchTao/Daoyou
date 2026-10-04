import { expect, it } from 'vitest';
import { allowsLocalDevTools } from './dev-tools-access.js';
it('never enables dev tools for staging, production or a missing deployment', () => {
  expect(allowsLocalDevTools('local', 'development')).toBe(true);
  for (const env of [undefined, 'staging', 'production'])
    expect(allowsLocalDevTools(env, 'development')).toBe(false);
  expect(allowsLocalDevTools('local', 'production')).toBe(false);
});
