import { SectCompiler } from '../compilation';
import type { CultivatorSectState } from '../domain';
import type { SectModule } from '../plugin';
import type { ValidationRule } from './ValidationPipeline';

/** 编译基础态、单节点态与全节点代表态，捕获空实现和战斗契约错误。 */
export class SectCompilationRule implements ValidationRule<SectModule> {
  validate(module: SectModule): void {
    const compiler = new SectCompiler();
    const definition = module.definition;
    const methods = Object.fromEntries(
      definition.methods.map((method) => [method.id, 100]),
    );
    const equipped = definition.abilities
      .filter((ability) => ability.occupiesActiveSlot)
      .slice(0, 4)
      .map((ability) => ability.id);
    const baseState: CultivatorSectState = {
      membershipId: `registry-validation:${definition.id}`,
      sectId: definition.id,
      status: 'active',
      contribution: 0,
      configVersion: definition.configVersion,
      methods,
      paths: [],
      abilityLoadout: [
        equipped[0] ?? null,
        equipped[1] ?? null,
        equipped[2] ?? null,
        equipped[3] ?? null,
      ],
    };
    compiler.compile(module, { sect: baseState, realm: '渡劫' });

    for (const path of definition.paths) {
      const pathBase: CultivatorSectState = {
        ...baseState,
        activePathId: path.id,
        paths: [
          {
            pathId: path.id,
            unlockedLayerIds: [...path.layers]
              .sort((left, right) => left.order - right.order)
              .map((layer) => layer.id),
            tacticId: path.defaultTacticId,
            activeMeridianSlot: 1,
            meridianLoadouts: [
              { slot: 1, nodeIds: [], version: 1 },
              { slot: 2, nodeIds: [], version: 1 },
              { slot: 3, nodeIds: [], version: 1 },
            ],
          },
        ],
      };
      const baseline = JSON.stringify(
        compiler.compile(module, { sect: pathBase, realm: '渡劫' }),
      );
      for (const node of path.nodes) {
        const nodeState = structuredClone(pathBase);
        const nodePath = nodeState.paths.find(
          (candidate) => candidate.pathId === path.id,
        )!;
        nodePath.meridianLoadouts.find(
          (loadout) => loadout.slot === 1,
        )!.nodeIds = [node.id];
        const compiled = compiler.compile(module, {
          sect: nodeState,
          realm: '渡劫',
        });
        if (JSON.stringify(compiled) === baseline) {
          throw new Error(`经脉节点 ${node.id} 的运行时行为为空`);
        }
      }
      // 穷举每层三选一的所有合法组合，确保节点交互也满足能力工厂契约。
      const orderedLayers = [...path.layers].sort((left, right) => left.order - right.order);
      const choices = orderedLayers.map((layer) =>
        path.nodes.filter((node) => node.layerId === layer.id),
      );
      const compileCombination = (layerIndex: number, nodeIds: string[]): void => {
        if (layerIndex >= choices.length) {
          const combination = structuredClone(pathBase);
          const combinationPath = combination.paths.find(
            (candidate) => candidate.pathId === path.id,
          );
          const loadout = combinationPath?.meridianLoadouts.find(
            (candidate) => candidate.slot === 1,
          );
          if (!loadout) throw new Error(`流派 ${path.id} 缺少校验经脉方案`);
          loadout.nodeIds = nodeIds;
          compiler.compile(module, { sect: combination, realm: '渡劫' });
          return;
        }
        for (const node of choices[layerIndex]) {
          compileCombination(layerIndex + 1, [...nodeIds, node.id]);
        }
      };
      compileCombination(0, []);
    }
  }
}
