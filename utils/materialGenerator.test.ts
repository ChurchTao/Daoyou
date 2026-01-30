import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { MaterialSkeleton } from '@/engine/material/creation/types';

describe('MaterialGenerator', () => {
  it('MaterialGenerator随机测试', async () => {
    const materials = await MaterialGenerator.generateRandom(3);
    console.log(materials);
  });

  it('test 材料生成器2', async () => {
    const materialSkeletons: MaterialSkeleton[] = [
      { type: 'manual', rank: '凡品', quantity: 1 },
      { type: 'manual', rank: '灵品', quantity: 1 },
      { type: 'manual', rank: '天品', quantity: 1 },
      { type: 'manual', rank: '仙品', quantity: 1 },
      { type: 'manual', rank: '神品', quantity: 1 },
    ];
    const materials =
      await MaterialGenerator.generateFromSkeletons(materialSkeletons);
    console.log(JSON.stringify(materials));
  });
});
