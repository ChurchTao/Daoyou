import { CreationContext } from '../CreationStrategy';
import { GongFaCreationStrategy } from './GongFaCreationStrategy';

// Mock the AI client
jest.mock('../../../utils/aiClient', () => ({
  object: jest.fn().mockResolvedValue({
    object: {
      name: '测试功法',
      grade_hint: 'medium',
      description: '基于典籍的测试功法。',
      selected_affixes: {
        primary: 'gongfa_spirit',
        secondary: 'gongfa_crit_rate',
      },
    },
  }),
}));

import { object } from '../../../utils/aiClient';

test('GongFaCreationStrategy test', async () => {
  const strategy = new GongFaCreationStrategy();
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
        name: '烈火经',
        type: 'manual',
        rank: '天品',
        quantity: 1,
        description: '传说中的火系经文。',
      },
    ],
    userPrompt: '创造一本火系功法',
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

  // Basic Assertions to ensure it worked
  expect(resultItem.name).toBe('测试功法');
  expect(resultItem.effects!.length).toBeGreaterThan(0);
});
