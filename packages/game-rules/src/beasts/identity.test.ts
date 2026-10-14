import { expect, it } from 'vitest';
import { beastOriginName } from './identity.js';

it('玩家只见宝宝与野生，变异不并写宝宝', () => {
  expect(beastOriginName({ originKind: 'baby' })).toBe('宝宝');
  expect(beastOriginName({ originKind: 'pseudo_baby' })).toBe('野生');
  expect(beastOriginName({ originKind: 'wild' })).toBe('野生');
  expect(beastOriginName({ originKind: 'baby', isMutant: true })).toBe('变异');
});
