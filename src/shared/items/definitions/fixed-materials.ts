import type { ItemDefinition } from '../types';
import { MaterialFactsSchema } from './materials';

export const FIXED_MATERIALS: ItemDefinition[] = [
  { id: 'material.ore.qingxi-iron.v1', name: '青溪铁砂', type: 'ore' },
  { id: 'material.aux.qingxi-stone.v1', name: '青溪磨石', type: 'aux' },
  { id: 'material.monster.qingxi-bone.v1', name: '青溪兽骨', type: 'monster' },
  { id: 'material.tcdb.qingxi-jade.v1', name: '青溪灵玉', type: 'tcdb' },
].map(({ id, name, type }) => ({
  id,
  name,
  kind: 'material',
  stackLimit: 99,
  material: MaterialFactsSchema.parse({
    name,
    type,
    rank: '凡品',
    description: '可用于铸造道装的灵材。',
  }),
}));
