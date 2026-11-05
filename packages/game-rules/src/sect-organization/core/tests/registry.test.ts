import { describe, expect, it } from 'vitest';
import { SectRegistry, createSectRuntime } from '../index.js';
import type { SectModule } from '../index.js';
import {
  FIXTURE_SECT_MODULE,
  fixtureSectState,
} from '../../testing/fixtures/FixtureSectModule.js';
import { createProductionSectCatalog } from '../../production/productionRuntime.js';

function withDefinition(
  change: (d: SectModule['definition']) => void,
): SectModule {
  const definition = structuredClone(FIXTURE_SECT_MODULE.definition);
  change(definition);
  return {
    definition,
    organization: FIXTURE_SECT_MODULE.organization,
    checkAdmission: (context) => FIXTURE_SECT_MODULE.checkAdmission(context),
  };
}
describe('宗门目录校验', () => {
  it('拒绝重复心法槽位', () => {
    expect(
      () =>
        new SectRegistry([
          withDefinition((d) => {
            d.methods[1].slot = 1;
          }),
        ]),
    ).toThrow('心法槽位');
  });
  it('拒绝跨流派重复节点标识', () => {
    expect(
      () =>
        new SectRegistry([
          withDefinition((d) => {
            d.paths[1].nodes[0].id = d.paths[0].nodes[0].id;
          }),
        ]),
    ).toThrow('跨流派重复节点');
  });
  it('拒绝入宗未知心法', () => {
    expect(
      () =>
        new SectRegistry([
          withDefinition((d) => {
            d.onboarding.initialMethods.unknown = 1;
          }),
        ]),
    ).toThrow('未知心法');
  });
});

describe('宗门组织注册与成员校验', () => {
  it('可注册只提供组织服务的宗门', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    expect(runtime.registry.require('fixture-sect')).toBe(FIXTURE_SECT_MODULE);
    expect(() => runtime.validateState(fixtureSectState())).not.toThrow();
  });

  it('生产目录拒绝重复宗门', () => {
    expect(() =>
      createProductionSectCatalog([
        { module: FIXTURE_SECT_MODULE },
        { module: FIXTURE_SECT_MODULE },
      ]),
    ).toThrow('重复宗门');
  });

  it('拒绝负贡献及无效成员状态', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    expect(() =>
      runtime.validateState({ ...fixtureSectState(), contribution: -1 }),
    ).toThrow('非负整数');
    expect(() =>
      runtime.validateState({ ...fixtureSectState(), status: 'invalid' as never }),
    ).toThrow('状态无效');
  });
});
