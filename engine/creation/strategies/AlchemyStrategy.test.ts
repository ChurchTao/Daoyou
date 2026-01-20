import { object } from '@/utils/aiClient';
import { CreationContext } from '../CreationStrategy';
import { AlchemyStrategy } from './AlchemyStrategy';

test('AlchemyStrategy test', async () => {
  const strategy = new AlchemyStrategy();
  const context: CreationContext = {
    cultivator: {
      id: 'test-cultivator',
      realm: '元婴',
      realm_stage: '初期',
      name: '测试修士',
      gender: '男',
      age: 20,
      lifespan: 100,
      attributes: {
        vitality: 100,
        spirit: 100,
        wisdom: 100,
        speed: 10,
        willpower: 100,
      },
      spiritual_roots: [],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: {
        artifacts: [],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: null,
        armor: null,
        accessory: null,
      },
      max_skills: 5,
      spirit_stones: 0,
    },
    materials: [
      {
        id: 'm1',
        name: '灵草',
        type: 'herb',
        rank: '玄品',
        quantity: 1,
        description: '一株神奇的草药。',
      },
      {
        id: 'm2',
        name: '灵水',
        type: 'aux',
        rank: '灵品',
        quantity: 1,
        description: '纯净的水。',
      },
    ],
    userPrompt: '炼制一颗治疗丹药',
  };

  await strategy.validate(context);
  const result = strategy.constructPrompt(context);
  console.log('--- Prompt Data ---');
  console.log(JSON.stringify(result, null, 2));

  const aiResponse = await object(result.system, result.user, {
    schema: strategy.schema,
    schemaName: strategy.schemaName,
    schemaDescription: strategy.schemaDescription,
  });

  console.log('--- AI Response ---');
  console.log(JSON.stringify(aiResponse.object, null, 2));

  const resultItem = strategy.materialize(aiResponse.object, context);
  console.log('--- Materialized Result ---');
  console.log(JSON.stringify(resultItem, null, 2));

  expect(resultItem.name).toBe('测试丹药');
  expect(resultItem.quantity).toBeGreaterThan(0);
});
