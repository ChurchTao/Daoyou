import type { Cultivator } from '@/types/cultivator';

/**
 * 假数据：排行榜
 * 用于演示和开发
 */
export const mockRankings: Cultivator[] = [
  {
    id: 'mock-001',
    name: '玄霄子',
    prompt: '正道天骄，剑道通神',
    cultivationLevel: '元婴中期',
    spiritRoot: '变异·雷灵根',
    appearance: '青衫长剑，眉目如星，周身雷光隐现',
    backstory: '出身名门，自幼习剑，三十岁便突破元婴，被誉为千年一遇的剑道奇才',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '紫府通明',
        type: '吉',
        effect: 'spirit +15',
        description: '元神澄澈，雷意自生。',
      },
      {
        name: '剑胆琴心',
        type: '吉',
        effect: 'speed +8',
        description: '剑心清明，出手如光。',
      },
      {
        name: '雷霆之子',
        type: '吉',
        effect: '雷系技能威力 +20%',
        description: '天生雷息，号令九霄。',
      },
    ],
    battleProfile: {
      maxHp: 300,
      hp: 300,
      element: '雷',
      attributes: {
        vitality: 100,
        spirit: 85,
        wisdom: 80,
        speed: 85,
      },
      skills: [
        {
          name: '万雷御剑',
          type: 'attack',
          power: 80,
          element: '雷',
          effects: ['stun'],
        },
        {
          name: '霄光护体',
          type: 'buff',
          power: 60,
          element: '雷',
          effects: ['speed_up', 'spirit_up'],
        },
        {
          name: '天罡雷息',
          type: 'heal',
          power: 70,
          element: '土',
          effects: ['heal'],
        },
      ],
      equipment: [
        {
          name: '惊雷剑',
          type: 'weapon',
          element: '雷',
          bonus: {
            spirit: 8,
            elementBoost: { 雷: 0.15 },
          },
        },
      ],
    },
  },
  {
    id: 'mock-002',
    name: '血手人屠',
    prompt: '魔道巨擘，嗜血成性',
    cultivationLevel: '元婴后期',
    spiritRoot: '血魔灵根',
    appearance: '黑袍遮身，双目赤红，周身血雾缭绕，手持一柄血色长刀',
    backstory: '曾是正道天骄，因心魔入体堕入魔道，以吞噬修士精血为乐，凶名赫赫',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '血煞命格',
        type: '凶',
        effect: 'wisdom -5, vitality +10',
        description: '煞气入骨，杀戮难止。',
      },
      {
        name: '魔心不灭',
        type: '吉',
        effect: 'max_hp +25',
        description: '心魔化盾，万劫不灭。',
      },
      {
        name: '夺魂摄魄',
        type: '凶',
        effect: '攻击附带夺魂',
        description: '以魂养身，邪威滔天。',
      },
    ],
    battleProfile: {
      maxHp: 350,
      hp: 350,
      element: '火',
      attributes: {
        vitality: 110,
        spirit: 80,
        wisdom: 65,
        speed: 60,
      },
      skills: [
        {
          name: '血海滔天',
          type: 'attack',
          power: 85,
          element: '火',
          effects: ['burn'],
        },
        {
          name: '魔焰护身',
          type: 'buff',
          power: 55,
          element: '火',
          effects: ['speed_up'],
        },
        {
          name: '血元回潮',
          type: 'heal',
          power: 65,
          element: '土',
          effects: ['heal'],
        },
      ],
      equipment: [
        {
          name: '血炼魔刀',
          type: 'weapon',
          element: '火',
          bonus: {
            vitality: 8,
            elementBoost: { 火: 0.15 },
          },
        },
      ],
    },
  },
  {
    id: 'mock-003',
    name: '林无尘',
    prompt: '靠炼丹逆袭的废柴少主',
    cultivationLevel: '金丹巅峰',
    spiritRoot: '变异·冰焰双生',
    appearance: '白衣染霜，眉心一点赤焰印记，腰间挂着一只古朴丹炉',
    backstory: '幼时被逐出宗门，靠一本残破丹方崛起，以丹道证得金丹大道',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '丹心通神',
        type: '吉',
        effect: 'spirit +12',
        description: '丹火入魂，心念通灵。',
      },
      {
        name: '逆脉修行',
        type: '凶',
        effect: 'speed -5, wisdom +5',
        description: '以逆行道脉锤炼己身。',
      },
      {
        name: '九重丹劫',
        type: '吉',
        effect: 'max_hp +20',
        description: '历经九劫，肉身如炉。',
      },
    ],
    battleProfile: {
      maxHp: 250,
      hp: 250,
      element: '火',
      attributes: {
        vitality: 90,
        spirit: 75,
        wisdom: 85,
        speed: 65,
      },
      skills: [
        {
          name: '冰焰双绝',
          type: 'attack',
          power: 75,
          element: '火',
          effects: ['burn'],
        },
        {
          name: '丹心护体',
          type: 'heal',
          power: 75,
          element: '土',
          effects: ['heal'],
        },
        {
          name: '逆脉爆发',
          type: 'buff',
          power: 50,
          element: '火',
          effects: ['spirit_up'],
        },
      ],
      equipment: [
        {
          name: '玄火丹炉',
          type: 'accessory',
          element: '火',
          bonus: {
            spirit: 8,
            elementBoost: { 火: 0.1 },
          },
        },
      ],
    },
  },
  {
    id: 'mock-004',
    name: '云瑶仙子',
    prompt: '清冷孤傲的剑仙',
    cultivationLevel: '金丹后期',
    spiritRoot: '水灵根',
    appearance: '白衣胜雪，长发如瀑，手持一柄寒冰长剑，气质清冷如月',
    backstory: '出身水月宗，以清冷孤傲闻名，剑法出神入化，被誉为水月第一剑',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '冰心玉骨',
        type: '吉',
        effect: 'wisdom +10',
        description: '心如寒霜，不染尘埃。',
      },
      {
        name: '水月镜花',
        type: '吉',
        effect: 'control 技能成功率 +10%',
        description: '虚实难测，幻灭自如。',
      },
      {
        name: '霜魄孤鸣',
        type: '凶',
        effect: 'speed +5, 无法结伴',
        description: '天性孤高，独行天下。',
      },
    ],
    battleProfile: {
      maxHp: 220,
      hp: 220,
      element: '水',
      attributes: {
        vitality: 80,
        spirit: 75,
        wisdom: 85,
        speed: 80,
      },
      skills: [
        {
          name: '寒霜剑雨',
          type: 'attack',
          power: 75,
          element: '水',
          effects: ['slow'],
        },
        {
          name: '水月镜花',
          type: 'control',
          power: 65,
          element: '水',
          effects: ['stun'],
        },
        {
          name: '冰心诀',
          type: 'heal',
          power: 65,
          element: '水',
          effects: ['heal'],
        },
      ],
      equipment: [
        {
          name: '寒霜古剑',
          type: 'weapon',
          element: '水',
          bonus: {
            speed: 5,
            elementBoost: { 水: 0.12 },
          },
        },
      ],
    },
  },
  {
    id: 'mock-005',
    name: '墨渊',
    prompt: '神秘的黑衣剑客',
    cultivationLevel: '金丹中期',
    spiritRoot: '暗灵根',
    appearance: '黑衣如墨，面容冷峻，腰间佩剑，周身散发阴冷气息',
    backstory: '来历不明，以暗杀闻名，剑法诡异莫测，令人闻风丧胆',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '无影无踪',
        type: '吉',
        effect: 'speed +10',
        description: '身形如烟，往来无迹。',
      },
      {
        name: '噬魂夺魄',
        type: '凶',
        effect: '攻击附带夺魄',
        description: '魂飞魄散，难入轮回。',
      },
      {
        name: '夜行孤星',
        type: '凶',
        effect: 'max_hp -10, crit +8%',
        description: '夜色之下，星光独泣。',
      },
    ],
    battleProfile: {
      maxHp: 200,
      hp: 200,
      element: '木',
      attributes: {
        vitality: 75,
        spirit: 70,
        wisdom: 70,
        speed: 85,
      },
      skills: [
        {
          name: '暗影突袭',
          type: 'attack',
          power: 75,
          element: '木',
          effects: ['bleed'],
        },
        {
          name: '无踪遁形',
          type: 'buff',
          power: 55,
          element: '木',
          effects: ['speed_up'],
        },
        {
          name: '噬魂锁',
          type: 'control',
          power: 65,
          element: '木',
          effects: ['stun'],
        },
      ],
      equipment: [
        {
          name: '影蚀匕首',
          type: 'weapon',
          element: '木',
          bonus: {
            speed: 6,
            elementBoost: { 木: 0.08 },
          },
        },
      ],
    },
  },
  {
    id: 'mock-006',
    name: '青莲剑仙',
    prompt: '潇洒不羁的剑客',
    cultivationLevel: '金丹初期',
    spiritRoot: '木灵根',
    appearance: '青衫飘逸，手持青莲剑，气质潇洒不羁，如诗如画',
    backstory: '出身青莲剑宗，以潇洒不羁闻名，剑法如诗如画，被誉为青莲剑仙',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '青莲剑骨',
        type: '吉',
        effect: 'spirit +8',
        description: '剑骨如莲，生生不息。',
      },
      {
        name: '云游四海',
        type: '吉',
        effect: 'speed +6',
        description: '浪迹天涯，心无所系。',
      },
      {
        name: '风流债',
        type: '凶',
        effect: 'wisdom -3',
        description: '情债缠身，心神易乱。',
      },
    ],
    battleProfile: {
      maxHp: 180,
      hp: 180,
      element: '木',
      attributes: {
        vitality: 70,
        spirit: 65,
        wisdom: 65,
        speed: 80,
      },
      skills: [
        {
          name: '青莲剑势',
          type: 'attack',
          power: 70,
          element: '木',
          effects: [],
        },
        {
          name: '莲华护身',
          type: 'buff',
          power: 52,
          element: '木',
          effects: ['speed_up', 'spirit_up'],
        },
        {
          name: '生生不息',
          type: 'heal',
          power: 60,
          element: '土',
          effects: ['heal'],
        },
      ],
      equipment: [
        {
          name: '青莲古剑',
          type: 'weapon',
          element: '木',
          bonus: {
            spirit: 4,
            elementBoost: { 木: 0.1 },
          },
        },
      ],
    },
  },
];
