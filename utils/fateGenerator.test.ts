// src/lib/utils.test.ts
import { generatePreHeavenFates } from './fateGenerator';

test('test 气运生成器', async () => {
  const fates = await generatePreHeavenFates(3);
  console.log(fates);
});
