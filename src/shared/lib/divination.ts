import { QI_RESTORE_TALISMAN_SCENARIOS } from '@shared/config/qiSystem';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { z } from 'zod';

export const DIVINATION_DIRECTIONS = [
  {
    id: 'forging',
    label: '炼器',
    advice: '先核对图纸与灵材，再静心开炉；器成于细处，不在一时急切。',
  },
  {
    id: 'alchemy',
    label: '炼丹',
    advice: '辨清药性，量力备材，莫因求快而乱了火候。',
  },
  {
    id: 'beast',
    label: '灵兽培养',
    advice: '先明灵兽禀赋，再定培养方向；朝夕相伴，也是修行。',
  },
  {
    id: 'retreat',
    label: '闭关',
    advice: '照看寿元与积累，择一段安稳时日，专心温养根基。',
  },
  {
    id: 'breakthrough',
    label: '突破',
    advice: '先看自身积累与准备，心静之后再作冲关之决。',
  },
  {
    id: 'dungeon',
    label: '秘境探索',
    advice: '整备行囊，照看气血法力，知进也知退。',
  },
  {
    id: 'wild',
    label: '野外寻觅',
    advice: '循境界择地而行，留心沿途生灵，遇见便是缘分。',
  },
  {
    id: 'spirit_field',
    label: '灵田照料',
    advice: '顺着植株的生长阶段照料，莫让期待催乱了时序。',
  },
] as const;
export type DivinationDirection = (typeof DIVINATION_DIRECTIONS)[number]['id'];
export const DivinationDirectionSchema = z.enum(
  DIVINATION_DIRECTIONS.map((item) => item.id),
);
export const DivinationDiceSchema = z.tuple([
  z.number().int().min(1).max(6),
  z.number().int().min(1).max(6),
  z.number().int().min(1).max(6),
]);
export type DivinationDice = z.infer<typeof DivinationDiceSchema>;

// 6 个三同号、4 个顺子、6 个对子、10 个散点卦。先匹配三同号，再顺子，再对子。
export const DIVINATION_OMENS = [
  {
    id: 'seed',
    name: '一元复始',
    verse: '雪下藏新绿，春从一念生。',
    meaning: '收心归本，新的积累始于眼前小事。',
  },
  {
    id: 'earth',
    name: '厚土藏珍',
    verse: '不争山上色，自有地中金。',
    meaning: '守住根基，在平常日子里积蓄力量。',
  },
  {
    id: 'flame',
    name: '三灯照夜',
    verse: '灯火相照处，长夜亦成明。',
    meaning: '把分散的心力聚拢，便能看清前路。',
  },
  {
    id: 'still',
    name: '四境归心',
    verse: '风来门不动，心定月常圆。',
    meaning: '外界纷扰暂且放下，先辨清自己的选择。',
  },
  {
    id: 'clouds',
    name: '五云会聚',
    verse: '万缕归同岫，清风自有期。',
    meaning: '诸般准备渐趋齐备，宜耐心整理已有所得。',
  },
  {
    id: 'heaven',
    name: '六曜同辉',
    verse: '六曜临高台，天光入袖来。',
    meaning: '难得的圆满之象；珍惜眼前机缘，仍以踏实之心前行。',
  },
  {
    id: 'steps',
    name: '拾阶见山',
    verse: '石阶才数级，已见远山青。',
    meaning: '循序渐进，小小进展也值得珍惜。',
  },
  {
    id: 'stream',
    name: '清溪引路',
    verse: '溪转疑无径，花开又一村。',
    meaning: '顺着已有线索前行，不必一开始便看见终点。',
  },
  {
    id: 'wind',
    name: '长风入帆',
    verse: '帆正风来处，千波一叶轻。',
    meaning: '认准方向再行动，准备与时机同样重要。',
  },
  {
    id: 'moonrise',
    name: '步月登高',
    verse: '登高休问远，明月已相随。',
    meaning: '眼界随积累展开，切忌因接近目标而急躁。',
  },
  {
    id: 'roots',
    name: '双根并生',
    verse: '两枝同雨露，一脉向春深。',
    meaning: '基础与目标相互照应，不可偏废其一。',
  },
  {
    id: 'mirror',
    name: '双镜照心',
    verse: '镜里观来路，灯前问本心。',
    meaning: '停下来复盘选择，比匆忙向前更有意义。',
  },
  {
    id: 'herons',
    name: '双鹭临汀',
    verse: '白鹭依沙立，潮来各有程。',
    meaning: '同行可以相助，但各自仍有适合的节奏。',
  },
  {
    id: 'bridge',
    name: '两岸一桥',
    verse: '隔水山相望，轻桥接旧途。',
    meaning: '把已有资源与当下目标连接，少走无谓弯路。',
  },
  {
    id: 'stars',
    name: '双星伴月',
    verse: '星微不争月，仍照夜归人。',
    meaning: '珍惜看似微小的辅助，它们也能照亮前路。',
  },
  {
    id: 'jade',
    name: '双璧合光',
    verse: '玉本藏山石，相磨始见温。',
    meaning: '长处需要打磨，合宜搭配胜过一味求多。',
  },
  {
    id: 'mist',
    name: '雾隐青岫',
    verse: '雾深山未改，缓步辨苔痕。',
    meaning: '暂时看不清时，先确认手边能够确定的事情。',
  },
  {
    id: 'lotus',
    name: '静水生莲',
    verse: '水静香先至，花开不问人。',
    meaning: '专心做好自己的事，不必时时与旁人比较。',
  },
  {
    id: 'bamboo',
    name: '竹影听风',
    verse: '叶动知风向，根深任雨斜。',
    meaning: '保持灵活，同时守住不轻易动摇的根基。',
  },
  {
    id: 'stone',
    name: '泉石相鸣',
    verse: '泉因石有韵，路借曲成幽。',
    meaning: '遇到阻碍时调整方法，也许能看见新的理解。',
  },
  {
    id: 'sail',
    name: '孤帆问渡',
    verse: '一叶横江上，先问岸边潮。',
    meaning: '出发之前确认条件，慎重并不等于退缩。',
  },
  {
    id: 'rain',
    name: '疏雨洗尘',
    verse: '细雨除尘色，青山见旧容。',
    meaning: '整理积累与杂念，让下一步更加清楚。',
  },
  {
    id: 'pine',
    name: '松间待鹤',
    verse: '松阴留半席，不催云外归。',
    meaning: '留出余地与耐心，不必强求每件事立刻回应。',
  },
  {
    id: 'plum',
    name: '寒枝报春',
    verse: '一枝先破雪，未必满园开。',
    meaning: '珍惜初步进展，也给后续成长留下时间。',
  },
  {
    id: 'lamp',
    name: '归灯照卷',
    verse: '归来灯尚暖，旧卷有新知。',
    meaning: '回头温习已有经验，往往能找到可用的答案。',
  },
  {
    id: 'horizon',
    name: '天水相涵',
    verse: '水阔天无际，心宽路自长。',
    meaning: '放宽眼界，允许自己从更长远的角度作选择。',
  },
] as const;
export type DivinationOmen = (typeof DIVINATION_OMENS)[number];

const SCATTERED_OMENS: Record<string, number> = {
  '124': 16,
  '125': 17,
  '126': 18,
  '134': 19,
  '135': 20,
  '136': 21,
  '145': 22,
  '146': 23,
  '156': 24,
  '235': 25,
  '236': 16,
  '245': 17,
  '246': 18,
  '256': 19,
  '346': 20,
  '356': 21,
};

export function resolveDivination(dice: DivinationDice) {
  const [a, b, c] = DivinationDiceSchema.parse(dice).sort(
    (left, right) => left - right,
  );
  const index =
    a === c
      ? a - 1
      : b === a + 1 && c === b + 1
        ? 6 + a - 1
        : a === b || b === c
          ? 10 + b - 1
          : SCATTERED_OMENS[`${a}${b}${c}`];
  const total = a + b + c;
  return {
    omen: DIVINATION_OMENS[index],
    total,
    rewardScenario:
      total === 18
        ? ('qi_restore_large' as const)
        : ('qi_restore_small' as const),
  };
}

export function divinationDayKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function fallbackDivination(
  direction: DivinationDirection,
  dice: DivinationDice,
) {
  const { omen } = resolveDivination(dice);
  const subject = DIVINATION_DIRECTIONS.find((item) => item.id === direction)!;
  return `「${omen.name}」：${omen.verse}\n\n${omen.meaning}你所问的是${subject.label}。${subject.advice}`;
}

export function divinationRewardFacts(dice: DivinationDice) {
  const { rewardScenario } = resolveDivination(dice);
  const reward = QI_RESTORE_TALISMAN_SCENARIOS[rewardScenario];
  return ConsumableFactsSchema.parse({
    name: reward.label,
    type: '符箓',
    quality: '凡品',
    description: `聚拢天地清气的符箓，使用后恢复${reward.amount}点天地灵气。`,
    spec: {
      kind: 'talisman',
      scenario: rewardScenario,
      sessionMode: 'consume_on_action',
    },
  });
}
