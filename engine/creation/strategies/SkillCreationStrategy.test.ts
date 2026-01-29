import { object } from '@/utils/aiClient';
import { CreationContext } from '../CreationStrategy';
import { SkillCreationStrategy } from './SkillCreationStrategy';

test('SkillCreationStrategy test', async () => {
  const strategy = new SkillCreationStrategy();
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
      spiritual_roots: [{ element: '火', strength: 90 }],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: {
        artifacts: [],
        consumables: [],
        materials: [],
      },
      equipped: {
        weapon: 'w1',
        armor: null,
        accessory: null,
      },
      max_skills: 5,
      spirit_stones: 0,
    },
    materials: [
      {
        id: 'm1',
        name: '火系神通典籍',
        type: 'manual',
        rank: '地品',
        quantity: 1,
        description: '一本强大的火系神通典籍。',
      },
    ],
    userPrompt: '创造一个火系攻击神通',
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

  expect(resultItem.element).toBe('火');
});
