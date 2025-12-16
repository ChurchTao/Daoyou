import { CreationContext } from './engine/creation/CreationStrategy';
import { SkillCreationStrategy } from './engine/creation/strategies/SkillCreationStrategy';
import { Cultivator } from './types/cultivator';

// Mock Cultivator
const mockCultivator: Cultivator = {
  id: 'test-id',
  userId: 'test-user',
  name: 'TestCultivator',
  realm: '筑基',
  realm_stage: '中期',
  attributes: {
    vitality: 50,
    spirit: 50,
    wisdom: 90, // High wisdom
    speed: 50,
    willpower: 50,
  },
  spiritual_roots: [{ element: '火', strength: 80, grade: '天灵根' }],
  inventory: {
    artifacts: [
      {
        id: 'weapon-1',
        name: '离火剑',
        element: '火',
        slot: 'weapon',
        bonus: {},
      },
    ],
    consumables: [],
    materials: [],
  },
  equipped: {
    weapon: 'weapon-1',
    armor: null,
    accessory: null,
  },
  skills: [],
} as unknown as Cultivator;

// Test Prompt Construction
const strategy = new SkillCreationStrategy();
const context: CreationContext = {
  cultivator: mockCultivator,
  materials: [],
  userPrompt: 'Create a powerful fire sword technique',
};

const promptData = strategy.constructPrompt(context);

console.log('=== System Prompt ===');
console.log(promptData.system);
console.log('=== User Prompt ===');
console.log(promptData.user);

if (promptData.user.includes('离火剑') && promptData.user.includes('火(80)')) {
  console.log('✅ Context injection successful');
} else {
  console.error('❌ Context injection failed');
}
