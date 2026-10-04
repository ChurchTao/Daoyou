import { expect, it } from 'vitest';
import {
  getSectOrganizationDefinition,
  SECT_ORGANIZATION_DEFINITIONS,
} from '@daoyou/game-content/sect-organization/definitions';
import { PRODUCTION_SECTS } from './productionRuntime.js';

it('轻量宗门身份目录与生产模块使用相同定义及版本', () => {
  expect(Object.keys(SECT_ORGANIZATION_DEFINITIONS).sort()).toEqual(
    PRODUCTION_SECTS.map(({ module }) => module.definition.id).sort(),
  );
  for (const { module } of PRODUCTION_SECTS) {
    expect(getSectOrganizationDefinition(module.definition.id)).toBe(
      module.definition,
    );
  }
  expect(() => getSectOrganizationDefinition('unknown')).toThrow('未知宗门');
  expect(() => getSectOrganizationDefinition('toString')).toThrow('未知宗门');
});
