import { SectCompiler } from '../compilation';
import { StandardSectRules, type CultivatorSectState } from '../domain';
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
      .filter((ability) => ability.kind === 'active')
      .slice(0, StandardSectRules.activeAbilitySlotCount)
      .map((ability) => ability.id);
    const baseState: CultivatorSectState = {
      membershipId: `registry-validation:${definition.id}`,
      sectId: definition.id,
      status: 'active',
      contribution: 0,
      configVersion: definition.configVersion,
      methods,
      paths: [],
      abilityLoadout: Array.from(
        { length: StandardSectRules.activeAbilitySlotCount },
        (_, index) => equipped[index] ?? null,
      ) as CultivatorSectState['abilityLoadout'],
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
            meridianLoadouts: StandardSectRules.meridianLoadoutSlots.map(
              (slot) => ({ slot, nodeIds: [], version: 1 }),
            ),
          },
        ],
      };
      compiler.compile(module, { sect: pathBase, realm: '渡劫' });
      for (const node of path.nodes) {
        const nodeState = structuredClone(pathBase);
        const nodePath = nodeState.paths.find(
          (candidate) => candidate.pathId === path.id,
        )!;
        nodePath.meridianLoadouts.find(
          (loadout) => loadout.slot === 1,
        )!.nodeIds = [node.id];
        compiler.compile(module, {
          sect: nodeState,
          realm: '渡劫',
        });
      }

      const firstByLayer = path.layers
        .sort((left, right) => left.order - right.order)
        .map((layer) => path.nodes.find((node) => node.layerId === layer.id))
        .filter((node): node is NonNullable<typeof node> => Boolean(node));
      const compileNodes = (nodeIds: string[]) => {
        const state = structuredClone(pathBase);
        const statePath = state.paths.find((entry) => entry.pathId === path.id)!;
        const loadout = statePath.meridianLoadouts.find((entry) => entry.slot === 1)!;
        loadout.nodeIds = nodeIds;
        compiler.compile(module, { sect: state, realm: '渡劫' });
      };
      compileNodes(firstByLayer.map((node) => node.id));
      for (const layer of path.layers) {
        for (const replacement of path.nodes.filter(
          (node) => node.layerId === layer.id,
        )) {
          compileNodes(
            firstByLayer.map((node) =>
              node.layerId === layer.id ? replacement.id : node.id,
            ),
          );
        }
      }
    }
  }
}
