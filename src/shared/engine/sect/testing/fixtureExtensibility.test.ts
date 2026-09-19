import { describe, expect, it } from 'vitest';
import { createProductionSectCatalog, productionSectRuntime } from '../content';
import { createSectRuntime } from '../core';
import {
  FIXTURE_SECT_MODULE,
  fixtureSectState,
} from './fixtures/FixtureSectModule';

describe('宗门组织扩展与成员状态', () => {
  it('组织目录注册不需要战斗编译器或选招策略', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    expect(runtime.registry.require('fixture-sect')).toBe(FIXTURE_SECT_MODULE);
    expect(() => runtime.validateState(fixtureSectState())).not.toThrow();
    expect(productionSectRuntime.registry.get('fixture-sect')).toBeUndefined();
    expect(runtime).not.toHaveProperty('compiler');
    expect(FIXTURE_SECT_MODULE).not.toHaveProperty('createBaseBuilder');
  });
  it('目录拒绝重复宗门并保留准入与组织服务', () => {
    expect(() =>
      createProductionSectCatalog([
        { module: FIXTURE_SECT_MODULE },
        { module: FIXTURE_SECT_MODULE },
      ]),
    ).toThrow('重复宗门');
    expect(
      FIXTURE_SECT_MODULE.checkAdmission({
        playerRace: 'human',
        realm: '筑基',
        stage: '初期',
      }).allowed,
    ).toBe(true);
    expect(FIXTURE_SECT_MODULE.organization.tasks.listDaily()).not.toHaveLength(
      0,
    );
  });
  it('成员校验拒绝负贡献与错误归属', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    expect(() => runtime.validateState({ ...fixtureSectState(), contribution: -1 })).toThrow('非负整数');
    expect(() => runtime.validateState({ ...fixtureSectState(), status: 'invalid' as never })).toThrow('状态无效');
  });
});
