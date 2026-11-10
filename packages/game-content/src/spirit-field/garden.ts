import type {
  SpiritGardenOutput,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
export const SPIRIT_GARDEN_OFFLINE_CAP_MS = 7 * day;
export const SPIRIT_GARDEN_COLLECTION_LIMIT = 24;

const herb = (name: string, description: string): SpiritGardenOutput => ({
  name,
  description,
  kind: 'herb',
  quantity: 1,
  cycleMs: 4 * hour,
});
const fruit = (
  name: string,
  family: NonNullable<SpiritGardenOutput['fruitFamily']>,
): SpiritGardenOutput => ({
  name,
  description: '由长养灵植凝结的灵果，药蕴与效用由品质决定。',
  kind: 'spirit_fruit',
  fruitFamily: family,
  quantity: 1,
  cycleMs: 12 * hour,
});
const treasure = (name: string): SpiritGardenOutput => ({
  name,
  description: '灵植经年凝出的本源精华，可作天材地宝使用。',
  kind: 'tcdb',
  quantity: 1,
  cycleMs: day,
});
function species(
  input: Pick<
    SpiritGardenSpecies,
    'id' | 'name' | 'description' | 'element' | 'unlockCount'
  > & { material: string; essence: SpiritGardenOutput },
): SpiritGardenSpecies {
  const baseOutput = herb(
    input.material,
    `${input.name}自然生长的灵材，可供炼丹使用。`,
  );
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    element: input.element,
    unlockCount: input.unlockCount,
    matureMs: 4 * minute,
    branchMs: day,
    evolveMs: 3 * day,
    baseOutput,
    branches: {
      abundance: {
        name: '繁茂',
        description: '专养枝叶，稳定增加灵材产量。',
        output: { ...baseOutput, quantity: 2 },
      },
      essence: {
        name: input.essence.kind === 'spirit_fruit' ? '结实' : '凝珍',
        description: `收束灵蕴，转为低频产出${input.essence.name}。`,
        output: input.essence,
      },
    },
  };
}
export const SPIRIT_GARDEN_SPECIES: readonly SpiritGardenSpecies[] = [
  species({
    id: 'green_vine',
    name: '青木藤',
    description: '细藤攀枝而生，叶脉流转温和木气，久养可凝结助益修炼的青藤果。',
    element: '木',
    unlockCount: 0,
    material: '青木藤叶',
    essence: fruit('青藤灵果', 'cultivation'),
  }),
  species({
    id: 'dew_grass',
    name: '风露草',
    description: '细叶随风集露，草心生机绵长，适合培养疗愈灵果。',
    element: '风',
    unlockCount: 0,
    material: '风露草叶',
    essence: fruit('回春露果', 'healing'),
  }),
  species({
    id: 'red_fruit',
    name: '赤炎株',
    description: '赤叶温热，根须蓄养火意，果实凝聚温养气血的灵蕴。',
    element: '火',
    unlockCount: 0,
    material: '赤炎灵叶',
    essence: fruit('赤炎血果', 'tempering'),
  }),
  species({
    id: 'moon_lotus',
    name: '月泉莲',
    description: '莲瓣承接水月清辉，莲房蕴含平和而清澈的灵气。',
    element: '水',
    unlockCount: 0,
    material: '月泉莲瓣',
    essence: fruit('月泉莲实', 'mana'),
  }),
  species({
    id: 'stone_fungus',
    name: '岩心芝',
    description: '菌盖如石，根丝深入土层，久养可凝出土脉灵髓。',
    element: '土',
    unlockCount: 0,
    material: '岩心芝片',
    essence: treasure('岩心灵髓'),
  }),
  species({
    id: 'beast_berry',
    name: '鸣雷莓',
    description: '枝间时有细雷轻鸣，灵兽亲近其气息，适宜养成果实饲育。',
    element: '雷',
    unlockCount: 0,
    material: '鸣雷莓叶',
    essence: fruit('鸣雷兽灵果', 'beast_cultivation'),
  }),
  species({
    id: 'jade_bamboo',
    name: '金玉竹',
    description: '竹节蕴有金石之音，凝成的竹髓是珍贵天材。',
    element: '金',
    unlockCount: 3,
    material: '金玉竹叶',
    essence: treasure('金玉竹髓'),
  }),
  species({
    id: 'longevity_tree',
    name: '寒玉寿木',
    description: '细枝覆着薄薄玉霜，生机内敛，结实后可得延寿灵果。',
    element: '冰',
    unlockCount: 5,
    material: '寒玉寿叶',
    essence: fruit('寒玉寿果', 'longevity'),
  }),
];
