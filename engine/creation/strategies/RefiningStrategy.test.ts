import { object } from '@/utils/aiClient';
import { CreationContext } from '../CreationStrategy';
import { RefiningStrategy } from './RefiningStrategy';

test('RefiningStrategy test', async () => {
  const strategy = new RefiningStrategy();
  const context: CreationContext = {
    cultivator: {
      realm: '元婴',
      realm_stage: '初期',
      name: '测试修士',
      gender: '男',
      age: 0,
      lifespan: 0,
      attributes: {
        vitality: 0,
        spirit: 0,
        wisdom: 0,
        speed: 0,
        willpower: 0,
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
      max_skills: 0,
      spirit_stones: 0,
    },
    materials: [
      //   {
      //     name: '赤阳玉髓',
      //     type: 'tcdb',
      //     rank: '天品',
      //     element: '火',
      //     description:
      //       '藏于火山深处熔岩缝隙，呈赤红琉璃状，内蕴精纯火灵力，可助元婴修士突破瓶颈，炼制火属性法宝时加入能提升其威力。',
      //     price: 80000,
      //     quantity: 1,
      //   },
      {
        name: '赤铁矿',
        type: 'ore',
        rank: '凡品',
        element: '土',
        description: '赤铁矿，普通炼器材料',
        price: 500000,
        quantity: 1,
      },
    ],
    userPrompt: `投入了地脉晶「仙品」天材地宝
神甲
灵力 +550｜悟性 +550｜神识 +550
雷系伤害 +55%
命中时90%概率附加疾速
命中时90%概率附加沉默
`,
  };
  await strategy.validate(context);
  const result = strategy.constructPrompt(context);
  console.log(JSON.stringify(result));
  const aiResponse = await object(result.system, result.user, {
    schema: strategy.schema,
    schemaName: strategy.schemaName,
    schemaDescription: strategy.schemaDescription,
  });
  console.log(aiResponse.object);

  const resultItem = strategy.materialize(aiResponse.object, context);
  console.log(JSON.stringify(resultItem));
});
