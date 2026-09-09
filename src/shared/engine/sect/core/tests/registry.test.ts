import { COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1 } from '@shared/engine/combat-v6/build-state';
import { describe, expect, it } from 'vitest';
import { SectRegistry, type SectModule } from '..';
import { PRODUCTION_SECTS } from '../../content';
import { FIXTURE_SECT_MODULE } from '../../testing/fixtures/FixtureSectModule';

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
describe('历史宗门目录校验', () => {
  it('保留与既有 V6 迁移表一致的五宗六心法槽位', () => {
    for (const { module } of PRODUCTION_SECTS) {
      const id = module.definition
        .id as keyof typeof COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1;
      expect(
        [...module.definition.methods]
          .sort((a, b) => a.slot - b.slot)
          .map((method) => method.id),
      ).toEqual(COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1[id]);
    }
  });
  it('拒绝重复心法槽位，防止迁移映射歧义', () => {
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
  it('拒绝入宗未知心法，防止生成无法迁移的玉牒', () => {
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
