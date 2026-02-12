import { object } from '@/utils/aiClient';
import { CreationContext } from '../CreationStrategy';
import { GongFaCreationStrategy } from './GongFaCreationStrategy';

describe('GongFaCreationStrategy validate', () => {
  const baseCultivator: CreationContext['cultivator'] = {
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
  };

  test('should reject when only skill manual is provided', async () => {
    const strategy = new GongFaCreationStrategy();
    const context: CreationContext = {
      cultivator: baseCultivator,
      materials: [
        {
          id: 'm1',
          name: '天雷裂空术图',
          type: 'skill_manual',
          rank: '地品',
          quantity: 1,
          description: '记载雷法攻伐术式。',
        },
      ],
      userPrompt: '参悟功法',
    };

    await expect(strategy.validate(context)).rejects.toThrow('功法典籍');
  });

  test('should accept legacy manual for backward compatibility', async () => {
    const strategy = new GongFaCreationStrategy();
    const context: CreationContext = {
      cultivator: baseCultivator,
      materials: [
        {
          id: 'm1',
          name: '养元真解',
          type: 'manual',
          rank: '地品',
          quantity: 1,
          description: '古旧典籍，记载周天运转。',
        },
      ],
      userPrompt: '参悟功法',
    };

    await expect(strategy.validate(context)).resolves.toBeUndefined();
  });

  test('constructPrompt should exclude pure skill manuals', () => {
    const strategy = new GongFaCreationStrategy();
    const context: CreationContext = {
      cultivator: baseCultivator,
      materials: [
        {
          id: 'm1',
          name: '太玄养元经',
          type: 'gongfa_manual',
          rank: '地品',
          quantity: 1,
          description: '功法典籍',
        },
        {
          id: 'm2',
          name: '离火裂空术',
          type: 'skill_manual',
          rank: '地品',
          quantity: 1,
          description: '神通秘术',
        },
      ],
      userPrompt: '参悟功法',
    };

    const prompt = strategy.constructPrompt(context);
    expect(prompt.system).toContain('太玄养元经');
    expect(prompt.system).not.toContain('离火裂空术');
  });
});

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
  expect(resultItem.effects!.length).toBeGreaterThan(0);
});
