import { describe, expect, it } from 'vitest';
import { SectRegistry, type SectModule } from '..';
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
