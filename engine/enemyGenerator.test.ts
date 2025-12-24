import { PlayerInfo } from '@/lib/dungeon/types';
import { enemyGenerator } from './enemyGenerator';

// Mock Player Info
const mockPlayer: PlayerInfo = {
  name: '韩立',
  realm: '筑基',
  gender: '男',
  age: 20,
  lifespan: 100,
  personality: '冷静',
  attributes: {
    vitality: 50,
    spirit: 50,
    wisdom: 50,
    speed: 50,
    willpower: 50,
  },
  spiritual_roots: ['火'],
  fates: [],
  skills: [],
  spirit_stones: 100,
  background: '测试背景',
  inventory: {
    artifacts: [],
    materials: [],
  },
};

test('test 敌人生成器', async () => {
  const metadata = {
    enemy_name: '古剑宗阵法中的古修士鬼魂',
    enemy_realm: '筑基',
    enemy_stage: '后期',
    is_boss: true,
  };
  const enemy = await enemyGenerator.generate(metadata, 10, mockPlayer);

  console.log('生成的敌人:', JSON.stringify(enemy, null, 2));

  expect(enemy.name).toBeDefined();
  expect(enemy.attributes).toBeDefined();
  expect(enemy.skills.length).toBeGreaterThan(0);
}, 30000); // 30s timeout for AI call
