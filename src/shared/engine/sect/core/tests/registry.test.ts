import { describe, expect, it } from 'vitest';
import {
  ConfiguredSectNodePlugin,
  SectRegistry,
  type SectModule,
  type SectPathModule,
} from '..';
import { FIXTURE_SECT_MODULE } from '../../testing/fixtures/FixtureSectModule';

function replacePath(pathId: string, replacement: SectPathModule): SectModule {
  const paths = new Map(FIXTURE_SECT_MODULE.paths);
  paths.set(pathId, {
    definition: replacement.definition,
    nodes: replacement.nodes,
    compileVariants: (context, builder) =>
      replacement.compileVariants(context, builder),
    createSelectionStrategy: (tacticId) =>
      replacement.createSelectionStrategy(tacticId),
  });
  return {
    definition: FIXTURE_SECT_MODULE.definition,
    paths,
    createBaseBuilder: (context) =>
      FIXTURE_SECT_MODULE.createBaseBuilder(context),
    checkAdmission: (context) => FIXTURE_SECT_MODULE.checkAdmission(context),
    createTrialScenario: (context) =>
      FIXTURE_SECT_MODULE.createTrialScenario(context),
  };
}

describe('宗门模块扩展契约', () => {
  it('第二宗门只通过模块注册即可完成定义、流派与战斗投影', () => {
    const registry = new SectRegistry([FIXTURE_SECT_MODULE]);
    const module = registry.require('fixture-sect');
    expect(module.definition.methods).toHaveLength(6);
    expect(module.definition.paths).toHaveLength(2);
    const build = module
      .createBaseBuilder({
        sect: {
          membershipId: 'm',
          sectId: 'fixture-sect',
          status: 'active',
          contribution: 0,
          configVersion: 1,
          methods: { 'fixture-method-1': 1 },
          paths: [],
          abilityLoadout: [null, null, null, null],
        },
        realm: '炼气',
      })
      .build();
    expect(build.abilities[build.defaultAbilityId]).toBeDefined();
  });

  it('拒绝有定义但没有插件的经脉节点', () => {
    const path = FIXTURE_SECT_MODULE.paths.get('fixture-first-path')!;
    const nodes = new Map(path.nodes);
    nodes.delete(path.definition.nodes[0].id);
    const invalid = replacePath(path.definition.id, {
      definition: path.definition,
      nodes,
      compileVariants: (context, builder) =>
        path.compileVariants(context, builder),
      createSelectionStrategy: (tacticId) =>
        path.createSelectionStrategy(tacticId),
    });
    expect(() => new SectRegistry([invalid])).toThrow('缺少节点插件');
  });

  it('拒绝不改变编译结果的空节点插件', () => {
    const path = FIXTURE_SECT_MODULE.paths.get('fixture-first-path')!;
    const first = path.definition.nodes[0];
    const nodes = new Map(path.nodes);
    nodes.set(first.id, new ConfiguredSectNodePlugin(first, () => undefined));
    const invalid = replacePath(path.definition.id, {
      definition: path.definition,
      nodes,
      compileVariants: (context, builder) =>
        path.compileVariants(context, builder),
      createSelectionStrategy: (tacticId) =>
        path.createSelectionStrategy(tacticId),
    });
    expect(() => new SectRegistry([invalid])).toThrow('运行时行为为空');
  });

  it('拒绝跨流派重复的节点和战术ID', () => {
    const duplicateNodeDefinition = structuredClone(
      FIXTURE_SECT_MODULE.definition,
    );
    duplicateNodeDefinition.paths[1].nodes[0].id =
      duplicateNodeDefinition.paths[0].nodes[0].id;
    expect(
      () =>
        new SectRegistry([
          { ...FIXTURE_SECT_MODULE, definition: duplicateNodeDefinition },
        ]),
    ).toThrow('跨流派重复节点ID');

    const duplicateTacticDefinition = structuredClone(
      FIXTURE_SECT_MODULE.definition,
    );
    duplicateTacticDefinition.paths[1].tactics[0].id =
      duplicateTacticDefinition.paths[0].tactics[0].id;
    expect(
      () =>
        new SectRegistry([
          { ...FIXTURE_SECT_MODULE, definition: duplicateTacticDefinition },
        ]),
    ).toThrow('跨流派重复战术ID');
  });
});
