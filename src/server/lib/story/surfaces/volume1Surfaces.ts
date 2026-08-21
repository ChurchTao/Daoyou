import type {
  MainStoryRuntimeEventType,
  StorySurfaceContext,
  StorySurfaceEntry,
  StorySurfaceKey,
} from '@shared/types/story';
import {
  QINGXI_HERB_SLOPE_NODE_ID,
  VOLUME_ONE_SECT_CAST,
  type StoryActorContext,
  type StoryProgressState,
} from '../volume1Definition';

export interface StorySurfaceInteractionCommand {
  eventType: MainStoryRuntimeEventType;
  payload: Record<string, unknown>;
}

const at = (progress: StoryProgressState, nodeId: string, step: string) =>
  progress.status === 'active' &&
  progress.currentNodeId === nodeId &&
  progress.currentStep === step;

const action = (
  id: string,
  label: string,
  variant: 'primary' | 'secondary' | 'ghost' = 'secondary',
) => ({ id, label, variant });

export function buildVolumeOneSurface(args: {
  progress: StoryProgressState;
  actor: StoryActorContext;
  surface: StorySurfaceKey;
  context?: StorySurfaceContext;
}): StorySurfaceEntry[] {
  const { progress, actor, surface, context } = args;
  const cast = VOLUME_ONE_SECT_CAST[actor.sectId];
  if (!cast || progress.status !== 'active') return [];

  if (
    surface === 'sect.affairs' &&
    at(progress, '01-00', 'affairs') &&
    context?.npcName === cast.daily
  ) {
    return [
      {
        id: 'v1-prologue-affairs-dialogue',
        surface,
        kind: 'npc-dialogue',
        npcName: cast.daily,
        topicLabel: '还有别的事吗？',
        topicTone: 'normal',
        messages: [
          {
            id: 'v1-affairs-extra',
            speaker: 'actor',
            text: `对了，${cast.herb}今早托人来问过你。药田今天正清点一批新苗，你若有空，过去搭把手。`,
          },
          {
            id: 'v1-affairs-ordinary',
            speaker: 'narrator',
            tone: 'muted',
            text: '听起来只是再普通不过的一件小事。',
          },
        ],
        actions: [
          {
            id: 'v1.prologue.affairs.observed',
            label: '我顺路去药田看看',
            tone: 'primary',
            href: '/game/sect/herb-garden',
          },
        ],
      },
    ];
  }

  if (surface === 'sect.herb-garden') {
    if (at(progress, '01-00', 'herb') && context?.npcName === cast.herb) {
      return [
        {
          id: 'v1-prologue-herb-dialogue',
          surface,
          kind: 'npc-dialogue',
          npcName: cast.herb,
          topicLabel: '今日新苗都齐了吗？',
          messages: [
            {
              id: 'v1-herb-normal',
              speaker: 'actor',
              text: '都齐了。根、叶、灵气都核过，没有哪一株需要单独记档。',
            },
            {
              id: 'v1-herb-seed-box',
              speaker: 'actor',
              text: '下午还有一批灵种从山门送进来。我正缺个人顺路搭把手。',
            },
          ],
          actions: [
            {
              id: 'v1.prologue.herb.observed',
              label: '我去山门帮你取',
              tone: 'primary',
              href: '/game/sect/gate',
            },
          ],
        },
      ];
    }
    if (at(progress, '01-01', 'root')) {
      return [
        {
          id: 'v1-root-anomaly',
          surface,
          kind: 'investigation',
          eyebrow: '药田边角 · 未登记植株',
          title: '灰白幼苗',
          intro: '它不在今天的灵种清册里。先别急着给它起名字，自己看看。',
          targets: [
            {
              id: 'flower',
              label: '看看灰白小花',
              result: '花瓣很凉，没有明显灵气波动，也没有枯萎迹象。',
            },
            {
              id: 'leaf',
              label: '查看叶脉',
              result: '叶脉结构和常见灵草不一样，但水分仍在流动——它确实活着。',
            },
            {
              id: 'root',
              label: '拨开根部泥土',
              result: '主根向下延伸约一寸。没有切口、腐烂或翻土痕迹。再往下挖，只有完整泥层。',
              cinematic: {
                title: '土下一寸',
                visual: 'root',
                acts: [
                  {
                    id: 'soil',
                    eyebrow: '药田 · 根部',
                    title: '向下',
                    body: '你沿着主根一点点拨开湿土。\n\n根须仍然完整，没有折痕。',
                  },
                  {
                    id: 'one-inch',
                    eyebrow: '土下一寸',
                    title: '到这里',
                    body: '主根向下延伸约一寸。\n\n然后，突然没有了。',
                  },
                  {
                    id: 'nothing',
                    eyebrow: '更深处',
                    title: '不是断口',
                    body: '你继续往下挖。\n\n没有断根，没有腐烂，没有空洞。只有从未被翻动过的完整泥层。',
                  },
                ],
              },
            },
          ],
          requiredTargetIds: ['root'],
          afterRequired: [
            '负责药田的人蹲下来重新拨了一遍土，沉默比你更久。',
          ],
          quote: '“不是断的。断根总该留下点东西。”',
          actions: [
            action('v1.root.keep', '由我暂存样本', 'primary'),
            action('v1.root.handover', '交给药田负责人封存'),
            action('v1.root.destroy', '当场毁去'),
          ],
        },
      ];
    }
  }

  if (surface === 'sect.archive') {
    if (at(progress, '01-02', 'archive') && context?.npcName === cast.archive) {
      return [
        {
          id: 'v1-root-record-dialogue',
          surface,
          kind: 'npc-dialogue',
          npcName: cast.archive,
          topicLabel: '给他看药田的观察记录',
          topicTone: 'primary',
          messages: [
            {
              id: 'v1-root-record-fact',
              speaker: 'narrator',
              text: '你只说已经确认的事实：植株仍活着，根在土下一寸消失，没有切口、腐烂或翻土。',
            },
            {
              id: 'v1-root-record-check',
              speaker: 'actor',
              text: '先别问它是什么。土层、根须、影子和灵气，我再核一遍。',
            },
            {
              id: 'v1-root-record-old',
              speaker: 'actor',
              tone: 'attention',
              text: '几十年前，也有人问过一个很像的问题。',
            },
          ],
          actions: [
            { id: 'v1.archive-root.ask-person', label: '当年是谁问过？', tone: 'primary' },
            { id: 'v1.archive-root.ask-records', label: '还有相似记录吗？' },
            { id: 'v1.archive-root.leave', label: '先只记事实', tone: 'muted' },
          ],
        },
      ];
    }

    if (
      at(progress, '01-06', 'lamps') &&
      actor.sectId !== 'youdu' &&
      context?.npcName === cast.archive
    ) {
      return [
        {
          id: 'v1-youdu-private-letter-dialogue',
          surface,
          kind: 'npc-dialogue',
          npcName: cast.archive,
          topicLabel: '桌上那封没盖宗门印的信是谁寄来的？',
          messages: [
            {
              id: 'v1-letter-origin',
              speaker: 'actor',
              text: '幽都来的。不是公函，是旧识之间的私信。',
            },
            {
              id: 'v1-letter-count',
              speaker: 'actor',
              tone: 'attention',
              text: '昨日招魂司登记十七名，今晨灯架却亮着十八盏。对方只问我们这里最近有没有“多出来、却说不出出处”的东西。',
            },
          ],
          actions: [
            {
              id: 'v1.lamps.letter-verified',
              label: '把这件事也记进当前卷宗',
              tone: 'primary',
            },
          ],
        },
      ];
    }

    if (at(progress, '01-08', 'letters') && context?.npcName === cast.archive) {
      return [
        {
          id: 'v1-four-sect-letters-dialogue',
          surface,
          kind: 'npc-dialogue',
          npcName: cast.archive,
          topicLabel: '问问那三封回信',
          topicTone: 'primary',
          messages: [
            {
              id: 'v1-four-letters-scene',
              speaker: 'narrator',
              text: '青溪残页压在镇纸下。旁边三封回信的纸张、墨色与落款习惯全都不同，却都避开同一个年代。',
            },
            {
              id: 'v1-four-letters-terms',
              speaker: 'actor',
              text: '没有人写“天门”，也没有人写“界外”。他们只反复写：缺页、无名、来处不明、不要公开。',
            },
            {
              id: 'v1-four-letters-old',
              speaker: 'actor',
              tone: 'attention',
              text: '我不是第一次给他们写信。只是以前，从来没有四边同时回。',
            },
          ],
          actions: [
            { id: 'v1.letters.ask', label: '你们以前也查过这段历史？', tone: 'primary' },
            { id: 'v1.letters.trust', label: '先继续查，我不往外说', tone: 'muted' },
          ],
        },
      ];
    }

    if (at(progress, '01-10', 'report') && context?.npcName === cast.archive) {
      return [
        {
          id: 'v1-report-voice-dialogue',
          surface,
          kind: 'npc-dialogue',
          npcName: cast.archive,
          topicLabel: '把筑基后听见的声音原样告诉他',
          topicTone: 'primary',
          messages: [
            {
              id: 'v1-report-voice-player',
              speaker: 'narrator',
              text: '你没有添任何解释，只把突破后听见的水声和那两句断断续续的话原样重复。',
            },
            {
              id: 'v1-report-voice-pause',
              speaker: 'narrator',
              tone: 'muted',
              text: `${cast.archive}很久没有动笔。`,
            },
            {
              id: 'v1-report-voice-answer',
              speaker: 'actor',
              tone: 'attention',
              text: '这件事，先不要在外面说。我原本希望，那些信会回答我：没有。',
            },
          ],
          actions: [
            { id: 'v1.voice.reported', label: '我明白了', tone: 'primary' },
          ],
        },
      ];
    }
  }

  if (surface === 'inn.spirit-spring' && at(progress, '01-03', 'spring')) {
    return [
      {
        id: 'v1-foreign-moon',
        surface,
        kind: 'cinematic',
        eyebrow: '灵眼之泉 · 水面',
        title: '泉里有一轮不属于这里的月',
        intro: '泉眼本身没有异动。只有水面安静得像一面镜子。',
        buttonLabel: '在泉边坐一会儿',
        visual: 'moon',
        acts: [
          {
            id: 'water',
            eyebrow: '灵眼之泉',
            title: '水面',
            body: '你低头看见的先是洞顶。\n\n水纹慢慢平下去。',
          },
          {
            id: 'stars',
            eyebrow: '倒影',
            title: '陌生星空',
            body: '洞顶不见了。水里映着一片你从未见过的星空。\n\n其中有两轮月。',
          },
          {
            id: 'look-up',
            eyebrow: '抬头',
            title: '洞顶还在',
            body: '你猛地抬头。\n\n头顶仍是洞壁。再低头，那片陌生天空还在水里。',
          },
        ],
        finalInteractionId: 'v1.spring.report',
        finalLabel: '把异象记下来',
      },
    ];
  }

  if (surface === 'auction.list' && at(progress, '01-04', 'auction')) {
    const createdAt = new Date();
    createdAt.setFullYear(createdAt.getFullYear() + 3);
    const expiresAt = new Date(createdAt);
    expiresAt.setDate(expiresAt.getDate() + 2);
    return [
      {
        id: 'v1-future-self-listing',
        surface,
        kind: 'auction-listing',
        listing: {
          id: 'story:v1:future-self-listing',
          sellerId: actor.cultivatorId,
          sellerName: actor.playerName,
          itemType: 'material',
          itemId: 'story-v1-future-gray-fragment',
          itemName: '灰纹石片',
          itemQuality: '凡品',
          itemCategory: 'ore',
          itemSnapshot: {
            id: 'story-v1-future-gray-fragment',
            name: '灰纹石片',
            type: 'ore',
            rank: '凡品',
            quantity: 1,
            description:
              '一块始终带着凉意的灰色石片。细纹像水退去留下的痕迹。寄售备注：从水声里捞出来的。',
            details: { storySurface: true, anomaly: 'future-self-listing' },
          },
          price: 1200,
          initialQuantity: 1,
          remainingQuantity: 1,
          visibility: 'public',
          status: 'active',
          createdAt: createdAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        detailInteractionId: 'v1.auction.inspect',
        cancelInteractionId: 'v1.auction.cancel',
        metaLabel: '寄售时间：三年后',
        timeLabel: '三年后才会上架',
      },
    ];
  }

  if (surface === 'black-market.room') {
    if (at(progress, '01-05', 'black-market')) {
      return [
        {
          id: 'v1-black-fragment',
          surface,
          kind: 'black-market-encounter',
          npcId: 'urgent-cultivator',
          statusLabel: '今日有怪货',
          eyebrow: '急售散修 · 摊沿',
          title: '灰纹石片',
          intro: '他今天没有先谈价，只把一块一直湿着的灰石压在摊沿。',
          objectName: '灰纹石片',
          objectDescription:
            '石片颜色发灰，细纹像水退去以后留下的浅痕。桌面很快被它洇出一圈湿印。',
          probes: [
            {
              id: 'look',
              label: '拿近一点看',
              dialogue: ['你：这水一直没干？', '急售散修：我拿到手就这样。你要能让它干，我还省心。'],
            },
            {
              id: 'origin',
              label: '问从哪来的',
              dialogue: ['你：哪里捡的？', '急售散修：太岳山外缘。旁边就一条小溪，可那晚听着跟海似的。'],
            },
            {
              id: 'price',
              label: '先问价',
              dialogue: ['你：多少？', '急售散修：先别嫌贵。这东西我拿着就做噩梦。'],
            },
          ],
          interjection: [
            '沉默老者：别买。',
            '急售散修：老头，你认识？',
            '沉默老者：不认识。',
            '急售散修：不认识你管什么？',
            '沉默老者：因为不该认识。',
          ],
          actions: [
            action('v1.black-fragment.buy', '买下石片', 'primary'),
            action('v1.black-fragment.heed', '听老者的，不买'),
            action('v1.black-fragment.hold', '让掌柜先压着'),
          ],
        },
      ];
    }
    if (at(progress, '01-07', 'elder-check')) {
      return [
        {
          id: 'v1-blank-page-elder',
          surface,
          kind: 'black-market-encounter',
          npcId: 'silent-elder',
          statusLabel: '旧物要看',
          eyebrow: '旧物鉴家 · 沉默老者',
          title: '青溪残页',
          intro: '你把残页平放在桌面。老者没有伸手，只隔着半臂看了很久。',
          interjection: [
            '你：纸有问题？',
            '沉默老者：纸不是问题。',
            '你：那什么是问题？',
            '沉默老者：空白。',
          ],
          actions: [action('v1.blank-page.elder-done', '收起残页', 'primary')],
        },
      ];
    }
  }

  if (surface === 'sect.affairs' && at(progress, '01-06', 'lamps') && actor.sectId === 'youdu') {
    const names = Array.from({ length: 17 }, (_, index) => `归魂记录 ${String(index + 1).padStart(2, '0')}`);
    return [
      {
        id: 'v1-eighteenth-lamp',
        surface,
        kind: 'lamp-ledger',
        eyebrow: '招魂司 · 今日归魂簿',
        title: '灯架和名册都在这里',
        ledgerNames: names,
        lampCount: 18,
        interactionId: 'v1.lamps.counted',
      },
    ];
  }

  if (
    surface === 'dungeon.settlement' &&
    context?.mapNodeId === QINGXI_HERB_SLOPE_NODE_ID
  ) {
    if (at(progress, '01-07', 'await-dungeon')) {
      return [
        {
          id: 'v1-qingxi-blank-page',
          surface,
          kind: 'dungeon-discovery',
          mode: 'discover',
          eyebrow: '结算之外 · 溪边',
          title: '石下还有东西',
          intro:
            '历练已经结束。你收起最后一份采集物时，溪边一块被水磨圆的旧石下露出很薄的一角。',
          interactionId: 'v1.blank-page.collect',
        },
      ];
    }
    if (at(progress, '01-07', 'found-page')) {
      return [
        {
          id: 'v1-qingxi-blank-page-route',
          surface,
          kind: 'dungeon-discovery',
          mode: 'route',
          eyebrow: '青溪残页 · 去向',
          title: '你准备先让谁看这张纸？',
          actions: [
            action('v1.blank-page.archive', '带回宗门传承', 'primary'),
            action('v1.blank-page.elder', '先拿给沉默老者看'),
            action('v1.blank-page.market', '去坊市鉴宝司试着鉴定'),
          ],
        },
      ];
    }
  }

  if (surface === 'market.recycle' && at(progress, '01-07', 'market-check')) {
    return [
      {
        id: 'v1-blank-page-appraisal',
        surface,
        kind: 'market-appraisal',
        eyebrow: '坊市鉴宝司 · 单件鉴评',
        title: '这张纸无法稳定归类',
        objectName: '青溪残页',
        attempts: ['古纸', '残符', '残卷', '杂物'],
        conclusion:
          '每次分类刚亮起，残页中央空白对应的阵纹就熄灭。不是“无价”，而是结论本身无法留下。',
        quote: '鉴宝师：“我干这行这么久，第一次见鉴定阵自己把结论擦掉。”',
        interactionId: 'v1.blank-page.market-done',
      },
    ];
  }

  if (surface === 'sect.gate') {
    if (at(progress, '01-00', 'gate') && context?.npcName === cast.gate) {
      return [
        {
          id: 'v1-prologue-gate-dialogue',
          surface,
          kind: 'npc-dialogue',
          npcName: cast.gate,
          topicLabel: '今日值录可有异样？',
          messages: [
            {
              id: 'v1-gate-normal',
              speaker: 'actor',
              text: '今日来去都对得上。名册、阵纹、值守更次，没有一处需要单独报。',
            },
            {
              id: 'v1-gate-next-day',
              speaker: 'actor',
              text: `${cast.herb}那批灵种我已经点交。她说清早还要再复一遍新苗，你若明日得空，再去看看也无妨。`,
            },
          ],
          actions: [
            {
              id: 'v1.prologue.gate.observed',
              label: '知道了',
              tone: 'primary',
              href: '/game/sect/herb-garden',
            },
          ],
        },
      ];
    }
    if (at(progress, '01-09', 'gate')) {
      return [
        {
          id: 'v1-night-gate-ledger',
          surface,
          kind: 'gate-ledger',
          eyebrow: '山门值录 · 子时后',
          title: '今日出入簿',
          rows: [
            { time: '酉时', name: '陈义', origin: '晋京', destination: '外院' },
            { time: '戌时', name: '柳川', origin: '坊市', destination: '内门' },
            { time: '子时', name: '陆……', origin: '', destination: '' },
          ],
          actions: [
            action('v1.gate.follow', '沿门外脚印追一段', 'primary'),
            action('v1.gate.report', '先把异常记录交给守档人'),
            action('v1.gate.lock', '先封住这页值录'),
          ],
        },
      ];
    }
  }

  return [];
}

const INTERACTIONS: Record<
  string,
  StorySurfaceInteractionCommand | ((payload: Record<string, unknown>) => StorySurfaceInteractionCommand)
> = {
  'v1.prologue.affairs.observed': { eventType: 'v1_affairs_observed', payload: {} },
  'v1.prologue.herb.observed': { eventType: 'v1_herb_normal_observed', payload: {} },
  'v1.prologue.gate.observed': { eventType: 'v1_gate_normal_observed', payload: {} },
  'v1.root.keep': { eventType: 'v1_root_investigated', payload: { choice: 'keep' } },
  'v1.root.handover': { eventType: 'v1_root_investigated', payload: { choice: 'handover' } },
  'v1.root.destroy': { eventType: 'v1_root_investigated', payload: { choice: 'destroy' } },
  'v1.archive-root.ask-person': { eventType: 'v1_archive_root_discussed', payload: { choice: 'ask_person' } },
  'v1.archive-root.ask-records': { eventType: 'v1_archive_root_discussed', payload: { choice: 'ask_records' } },
  'v1.archive-root.leave': { eventType: 'v1_archive_root_discussed', payload: { choice: 'leave' } },
  'v1.spring.report': { eventType: 'v1_spring_moon_observed', payload: { choice: 'report' } },
  'v1.spring.conceal': { eventType: 'v1_spring_moon_observed', payload: { choice: 'conceal' } },
  'v1.spring.joke': { eventType: 'v1_spring_moon_observed', payload: { choice: 'joke' } },
  'v1.auction.inspect': { eventType: 'v1_auction_future_listing_opened', payload: {} },
  'v1.auction.cancel': { eventType: 'v1_auction_future_listing_resolved', payload: { action: 'cancel' } },
  'v1.black-fragment.buy': { eventType: 'v1_black_market_fragment_resolved', payload: { choice: 'buy' } },
  'v1.black-fragment.heed': { eventType: 'v1_black_market_fragment_resolved', payload: { choice: 'heed' } },
  'v1.black-fragment.hold': { eventType: 'v1_black_market_fragment_resolved', payload: { choice: 'hold' } },
  'v1.lamps.counted': { eventType: 'v1_lamp_mismatch_verified', payload: {} },
  'v1.lamps.letter-verified': { eventType: 'v1_lamp_mismatch_verified', payload: {} },
  'v1.blank-page.collect': (payload) => ({
    eventType: 'dungeon_blank_page_collected',
    payload: { nodeId: String(payload.mapNodeId ?? QINGXI_HERB_SLOPE_NODE_ID) },
  }),
  'v1.blank-page.archive': { eventType: 'v1_blank_page_route_selected', payload: { choice: 'archive' } },
  'v1.blank-page.elder': { eventType: 'v1_blank_page_route_selected', payload: { choice: 'elder' } },
  'v1.blank-page.market': { eventType: 'v1_blank_page_route_selected', payload: { choice: 'sell' } },
  'v1.blank-page.elder-done': { eventType: 'v1_blank_page_elder_checked', payload: {} },
  'v1.blank-page.market-done': { eventType: 'v1_blank_page_market_checked', payload: {} },
  'v1.letters.ask': { eventType: 'v1_archive_letters_handled', payload: { choice: 'ask' } },
  'v1.letters.trust': { eventType: 'v1_archive_letters_handled', payload: { choice: 'trust' } },
  'v1.gate.follow': { eventType: 'v1_gate_ledger_resolved', payload: { choice: 'follow' } },
  'v1.gate.report': { eventType: 'v1_gate_ledger_resolved', payload: { choice: 'report' } },
  'v1.gate.lock': { eventType: 'v1_gate_ledger_resolved', payload: { choice: 'lock' } },
  'v1.voice.reported': { eventType: 'v1_archive_voice_reported', payload: {} },
};

export function resolveVolumeOneSurfaceInteraction(
  interactionId: string,
  payload: Record<string, unknown>,
): StorySurfaceInteractionCommand | null {
  const resolver = INTERACTIONS[interactionId];
  if (!resolver) return null;
  return typeof resolver === 'function' ? resolver(payload) : resolver;
}

export function isVolumeOneInteractionAvailable(args: {
  progress: StoryProgressState;
  actor: StoryActorContext;
  interactionId: string;
  payload: Record<string, unknown>;
}): boolean {
  const surfaces: StorySurfaceKey[] = [
    'sect.affairs',
    'sect.herb-garden',
    'sect.archive',
    'sect.gate',
    'inn.spirit-spring',
    'auction.list',
    'black-market.room',
    'market.recycle',
    'dungeon.settlement',
  ];
  const context: StorySurfaceContext = {
    mapNodeId:
      typeof args.payload.mapNodeId === 'string' ? args.payload.mapNodeId : undefined,
    npcName:
      typeof args.payload.npcName === 'string' ? args.payload.npcName : undefined,
  };
  return surfaces.some((surface) =>
    buildVolumeOneSurface({
      progress: args.progress,
      actor: args.actor,
      surface,
      context,
    }).some((entry) => {
      if (entry.kind === 'auto') return entry.interactionId === args.interactionId;
      if (entry.kind === 'cinematic') return entry.finalInteractionId === args.interactionId;
      if (entry.kind === 'lamp-ledger') return entry.interactionId === args.interactionId;
      if (entry.kind === 'market-appraisal') return entry.interactionId === args.interactionId;
      if (entry.kind === 'dungeon-discovery') {
        return (
          entry.interactionId === args.interactionId ||
          entry.actions?.some((candidate) => candidate.id === args.interactionId)
        );
      }
      if (entry.kind === 'auction-listing') {
        return (
          entry.detailInteractionId === args.interactionId ||
          entry.cancelInteractionId === args.interactionId
        );
      }
      if (
        entry.kind === 'black-market-encounter' ||
        entry.kind === 'card' ||
        entry.kind === 'investigation' ||
        entry.kind === 'gate-ledger' ||
        entry.kind === 'npc-dialogue'
      ) {
        return entry.actions.some((candidate) => candidate.id === args.interactionId);
      }
      return false;
    }),
  );
}
