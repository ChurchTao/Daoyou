import { generateRandomMaterials } from './materialGenerator';

test('test 材料生成器', async () => {
  const materials = await generateRandomMaterials(1);
  console.log(materials);
});
