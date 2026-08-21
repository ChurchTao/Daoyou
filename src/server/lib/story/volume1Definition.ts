import {
  MAIN_STORY_V1_ID,
  MAIN_STORY_V1_VERSION,
  type MainStoryActionLink,
  type MainStoryChoice,
  type MainStoryContinuation,
  type MainStoryScene,
  type MainStorySnapshot,
} from '@shared/types/story';

export type StoryFlagValue = string | boolean | number | null;
export type StoryFlags = Record<string, StoryFlagValue>;
export type StoryNpcTrust = Record<string, number>;

export interface StoryProgressState {
  storyId: string;
  storyVersion: number;
  status: 'active' | 'completed';
  currentNodeId: string;
  currentStep: string;
  flags: StoryFlags;
  npcTrust: StoryNpcTrust;
  completedAt: Date | null;
}

export interface StoryActorContext {
  cultivatorId: string;
  playerName: string;
  realm: string;
  sectId: string;
}

export interface StoryTransition {
  nodeId: string;
  step: string;
  status?: 'active' | 'completed';
  setFlags?: StoryFlags;
  trustDelta?: Record<string, number>;
  completed?: boolean;
  eventPayload?: Record<string, unknown>;
}

export const VOLUME_ONE_TITLE = '第一卷·微末有异';
export const VOLUME_TWO_TITLE = '第二卷·旧史无名';
export const QINGXI_HERB_SLOPE_NODE_ID = 'SAT_TN_08';

const NODE_ORDER = [
  '01-00',
  '01-01',
  '01-02',
  '01-03',
  '01-04',
  '01-05',
  '01-06',
  '01-07',
  '01-08',
  '01-09',
  '01-10',
] as const;

type NodeId = (typeof NODE_ORDER)[number];

type SectCast = {
  label: string;
  daily: string;
  herb: string;
  archive: string;
  gate: string;
  cultivation: string;
  rootReaction: string;
  archiveGesture: string;
  gateAnomaly: string;
  breakthroughAdvice: string;
  letterAddressees: string;
};

export const VOLUME_ONE_SECT_CAST: Record<string, SectCast> = {
  lingxiao: {
    label: '红尘剑宗',
    daily: '陆青崖',
    herb: '秦晚晴',
    archive: '温不言',
    gate: '骆长亭',
    cultivation: '晏无声',
    rootReaction:
      '有人拿剑削过的根，我一眼就能看出来。这个不是。土也没翻过。它像是……从这里开始，根就不归这块地管了。',
    archiveGesture: '温不言停笔片刻，从最里层抽出一封没有落款的旧信，又原样压回卷底。',
    gateAnomaly:
      '骆长亭带你沿石阶追出山门。夜露里只有七枚湿脚印，第八步本该落下的地方，石面干净得像从未有人走过。',
    breakthroughAdvice: '筑基先筑自己，不筑天下。',
    letterAddressees: '既白道兄、空渡师兄、褚先生',
  },
  tianyan: {
    label: '天衍圣地',
    daily: '知微',
    herb: '元吉',
    archive: '既白真人',
    gate: '望舒',
    cultivation: '抱一真人',
    rootReaction:
      '水、木、土三项都能对上。可一株草不可能只有上半截参与五行循环。若数据都是真的，那缺的不是根，是我们没算进去的东西。',
    archiveGesture: '既白真人在纸角写下四个数，算到最后却把其中一个重重划去，像是不愿留下结果。',
    gateAnomaly:
      '望舒重新校过星位、云气与山门阵纹，一切都在常数之内，唯独阵盘中央多出一缕无法归入任何五行属性的微弱响应。',
    breakthroughAdvice: '外面的数若算不明，先把自己的气机归一。突破时不必替天地解题。',
    letterAddressees: '温兄、空渡禅师、褚先生',
  },
  wuxiang: {
    label: '无相禅宗',
    daily: '法明',
    herb: '行愿',
    archive: '空渡禅师',
    gate: '道安禅师',
    cultivation: '寂然禅师',
    rootReaction:
      '先别叫它怪物。它还在活，也没有伤人。可若根不在这里，它又从哪里吃到这一口水？',
    archiveGesture: '空渡禅师翻出一页颜色更深的旧纸，只看一眼便重新封回经夹，没有让你看清上面的字。',
    gateAnomaly:
      '道安禅师确认山门示警没有响过。铜镜里却残着半个人影——只到肩线，像另一半还站在镜面照不到的地方。',
    breakthroughAdvice: '听见什么便听见，看见什么便看见。不要为了证明它是真的，反倒丢了自己。',
    letterAddressees: '温施主、既白真人、褚先生',
  },
  youdu: {
    label: '幽都',
    daily: '照灯',
    herb: '柳十三',
    archive: '褚先生',
    gate: '顾长夜',
    cultivation: '宁无恙',
    rootReaction:
      '你看叶子的影。风吹的时候影子慢半息。根倒没断……更像另一头还在什么地方。',
    archiveGesture: '褚先生没有去找相似植物，只在旧册边上写下五个字：又是缺一截。',
    gateAnomaly:
      '顾长夜把三盏验魂灯都移到门槛前。灯火没有一盏晃动——昨夜那位访客，既不像活人，也不像应归幽都的死魂。',
    breakthroughAdvice: '三魂七魄都在，你便安心入静。若听见有人叫你名字，先别急着应。',
    letterAddressees: '温不言、既白、空渡',
  },
};

const NODE_TITLES: Record<NodeId, string> = {
  '01-00': '山门如常',
  '01-01': '土下一寸',
  '01-02': '留在纸上的根',
  '01-03': '泉中有月',
  '01-04': '三年之后',
  '01-05': '不要买',
  '01-06': '第十八盏灯',
  '01-07': '青溪残页',
  '01-08': '旧信不署名',
  '01-09': '夜半山门',
  '01-10': '有人吗？',
};

const MAIN_SCENE_KEYS: Record<string, string> = {
  '01-00:affairs': 'v1.01-00.affairs',
  '01-00:herb': 'v1.01-00.herb',
  '01-00:gate': 'v1.01-00.gate',
  '01-01:root': 'v1.01-01.root',
  '01-02:archive': 'v1.01-02.archive',
  '01-03:spring': 'v1.01-03.spring',
  '01-04:auction': 'v1.01-04.auction',
  '01-05:black-market': 'v1.01-05.black-market',
  '01-06:lamps': 'v1.01-06.lamps',
  '01-07:found-page': 'v1.01-07.blank-page',
  '01-07:elder-check': 'v1.01-07.elder-check',
  '01-07:market-check': 'v1.01-07.market-check',
  '01-08:letters': 'v1.01-08.letters',
  '01-09:gate': 'v1.01-09.night-gate',
  '01-10:pre-breakthrough': 'v1.01-10.pre-breakthrough',
  '01-10:voice': 'v1.01-10.voice',
  '01-10:report': 'v1.01-10.report',
};

export function createInitialStoryProgress(): StoryProgressState {
  return {
    storyId: MAIN_STORY_V1_ID,
    storyVersion: MAIN_STORY_V1_VERSION,
    status: 'active',
    currentNodeId: '01-00',
    currentStep: 'affairs',
    flags: {},
    npcTrust: {},
    completedAt: null,
  };
}

export function getExpectedSceneKey(progress: StoryProgressState): string | null {
  if (progress.status === 'completed') return null;
  return MAIN_SCENE_KEYS[`${progress.currentNodeId}:${progress.currentStep}`] ?? null;
}

export function buildStorySnapshot(
  progress: StoryProgressState | null,
  lockedReason?: string,
): MainStorySnapshot {
  if (!progress) {
    return {
      storyId: MAIN_STORY_V1_ID,
      version: MAIN_STORY_V1_VERSION,
      volumeTitle: VOLUME_ONE_TITLE,
      status: 'locked',
      lockReason: lockedReason ?? '加入宗门后，主线卷宗才会开始记录。',
      currentNodeId: null,
      currentStep: null,
      currentTitle: '尚未启卷',
      progressText: '0 / 11',
      summary: '先完成拜宗。主线不会替代入门引导、破境任务或宗门勤务。',
      action: null,
      knownFacts: [],
      nextVolumeTitle: VOLUME_TWO_TITLE,
    };
  }

  if (progress.status === 'completed') {
    return {
      storyId: MAIN_STORY_V1_ID,
      version: MAIN_STORY_V1_VERSION,
      volumeTitle: VOLUME_ONE_TITLE,
      status: 'completed',
      currentNodeId: progress.currentNodeId,
      currentStep: progress.currentStep,
      currentTitle: '卷终·有人吗？',
      progressText: '11 / 11',
      summary:
        '你已经确认这些异象并非彼此孤立。有人从极远处发出声音，而宗门里的某些老人显然知道得更多。',
      action: null,
      knownFacts: buildKnownFacts(progress),
      completedAt: progress.completedAt?.toISOString() ?? null,
      nextVolumeTitle: VOLUME_TWO_TITLE,
    };
  }

  const nodeId = progress.currentNodeId as NodeId;
  const index = Math.max(0, NODE_ORDER.indexOf(nodeId));
  return {
    storyId: MAIN_STORY_V1_ID,
    version: MAIN_STORY_V1_VERSION,
    volumeTitle: VOLUME_ONE_TITLE,
    status: 'active',
    currentNodeId: progress.currentNodeId,
    currentStep: progress.currentStep,
    currentTitle: `${progress.currentNodeId} · ${NODE_TITLES[nodeId] ?? '未名卷页'}`,
    progressText: `${index + 1} / ${NODE_ORDER.length}`,
    summary: getStepSummary(progress),
    action: getStoryAction(progress),
    knownFacts: buildKnownFacts(progress),
    completedAt: progress.completedAt?.toISOString() ?? null,
    nextVolumeTitle: VOLUME_TWO_TITLE,
  };
}

export function buildKnownFacts(progress: StoryProgressState): string[] {
  const facts: string[] = [];
  if (progress.flags['story.v1.root_anomaly_seen'] === true) {
    facts.push('宗门药田出现一株活着的灰白幼苗：根在土下一寸处无切口地消失。');
  }
  if (progress.flags['story.v1.foreign_moon_seen'] === true) {
    facts.push('灵眼之泉曾映出陌生星空与第二轮月亮；抬头时洞顶一切正常。');
  }
  if (progress.flags['story.v1.future_listing_seen'] === true) {
    facts.push('拍卖行出现过一条“三年之后”由你本人寄售的灰纹石片记录，再看时已经消失。');
  }
  if (progress.flags['story.v1.black_fragment_seen'] === true) {
    facts.push('暗巷出现与拍卖记录相似的湿冷灰纹石片；沉默老者第一次主动说“别买”。');
  }
  if (progress.flags['story.v1.eighteenth_lamp']) {
    facts.push('幽都有一份灯册对不上：册上十七个名字，却有十八盏魂灯。');
  }
  if (progress.flags['story.v1.blank_page_found'] === true) {
    facts.push('青溪灵草坡发现无字残页；中央空白会让跨过它的墨迹或灵力痕迹消失。');
  }
  if (progress.flags['story.v1.archive_network_hint'] === true) {
    facts.push('四宗守档者彼此是旧识，而且他们显然曾经共同查过类似的“缺失”。');
  }
  if (progress.flags['story.v1.night_visitor_choice']) {
    facts.push('山门簿出现一笔无人记得写过的夜间记录：来处与去处都是空白。');
  }
  if (progress.flags['story.v1.first_voice_heard'] === true) {
    facts.push('筑基后，你听见极远水声中的陌生声音：“……有人吗？”');
  }
  return facts;
}

function getStepSummary(progress: StoryProgressState): string {
  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  const summaries: Record<string, string> = {
    '01-00:affairs': '先照常去执事堂走一趟。真正的异样，需要先有一个足够平常的参照。',
    '01-00:herb': '事务已了，再去药田看看今日长势。',
    '01-00:gate': '最后经过山门。骆册、阵纹、来去之人，都应当有迹可查。',
    '01-01:root': '药田里出现了一株无法用“折断”解释的灵植。',
    '01-02:archive': '把你真正看见的事实交给守档之人，不要先替它补上答案。',
    '01-03:spring': '去灵眼之泉歇一阵。那里本该只有水声和洞顶。',
    '01-04:auction': '拍卖行里出现了一条不可能成立的寄售记录。',
    '01-05:black-market': '暗巷里有人带来一块湿冷灰石；沉默老者第一次主动阻止交易。',
    '01-06:lamps': '一份来自幽都的灯册对不上数。',
    '01-07:await-dungeon': '去太岳山·青溪灵草坡正常历练。不要为了主线跳过原本的探索。',
    '01-07:found-page': '溪边石下压着一张无法留下文字的残页。',
    '01-07:elder-check': '先把残页拿给那个总像知道旧事的沉默老者看一眼。',
    '01-07:market-check': '坊市能给万物归类估价；看看这张残页能不能被正常识别。',
    '01-08:letters': '守档之人要把同一个问题寄给三位很久没联系的旧友。',
    '01-09:gate': '山门簿上多出了一笔没人记得写过的夜间出入记录。',
    '01-10:pre-breakthrough': '诸事未明。先收心，准备筑基。',
    '01-10:await-breakthrough': '完成现有破境卷宗并按原有规则筑基。主线不会绕过原有突破系统。',
    '01-10:voice': '突破后的寂静里，有一个极远的声音在确认这里是否有人。',
    '01-10:report': '你需要把真正听见的两个句子告诉守档之人。',
  };
  return summaries[key] ?? '卷页仍在等待下一处线索。';
}

export function getStoryAction(progress: StoryProgressState): MainStoryActionLink | null {
  if (progress.status === 'completed') return null;
  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  const actions: Record<string, MainStoryActionLink> = {
    '01-00:affairs': { label: '前往宗门事务', href: '/game/sect/affairs' },
    '01-00:herb': { label: '前往宗门药田', href: '/game/sect/herb-garden' },
    '01-00:gate': { label: '前往宗门山门', href: '/game/sect/gate' },
    '01-01:root': { label: '查看药田异样', href: '/game/sect/herb-garden' },
    '01-02:archive': { label: '前往宗门传承', href: '/game/sect/archive' },
    '01-03:spring': { label: '前往灵眼之泉', href: '/game/inn' },
    '01-04:auction': { label: '前往拍卖行', href: '/game/auction' },
    '01-05:black-market': { label: '前往暗巷黑市', href: '/game/black-market' },
    '01-06:lamps': { label: '再访宗门传承', href: '/game/sect/archive' },
    '01-07:await-dungeon': {
      label: '循线去青溪灵草坡',
      href: `/game/dungeon?nodeId=${QINGXI_HERB_SLOPE_NODE_ID}`,
      hint: '正常完成一次该历练点；残页会在结算后自然出现。',
    },
    '01-07:elder-check': { label: '去暗巷找沉默老者', href: '/game/black-market' },
    '01-07:market-check': { label: '去坊市鉴宝司试着鉴定', href: '/game/market/recycle' },
    '01-08:letters': { label: '带残页回宗门传承', href: '/game/sect/archive' },
    '01-09:gate': { label: '夜访宗门山门', href: '/game/sect/gate' },
    '01-10:pre-breakthrough': { label: '前往静室修行', href: '/game/retreat' },
    '01-10:await-breakthrough': { label: '继续正常修行与突破', href: '/game/retreat' },
    '01-10:report': { label: '回宗门传承处', href: '/game/sect/archive' },
  };
  return actions[key] ?? null;
}

export function buildStoryContinuation(
  progress: StoryProgressState,
  actor: StoryActorContext,
): MainStoryContinuation | null {
  if (progress.status === 'completed') {
    return {
      kind: 'complete',
      title: '第一卷 · 微末有异',
      narration: [
        '卷页暂时合上。你没有得到“天门”“万界”或任何宏大的答案。',
        '你只确认了三件事：异常真实存在；有人一直知道一部分；而极远处，确实有一个声音在问这里有没有人。',
      ],
      action: null,
      dismissLabel: '收起卷页',
    };
  }

  const cast = castOf(actor.sectId);
  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  const action = getStoryAction(progress);
  const beats: Record<string, Omit<MainStoryContinuation, 'action'>> = {
    '01-00:herb': {
      kind: 'travel',
      title: '日常还没结束',
      narration: [
        `你走出执事堂时，${cast.daily}在身后又补了一句：药田今天正清点新苗，若有空便过去搭把手。`,
        '这只是再普通不过的一件小事。',
      ],
    },
    '01-00:gate': {
      kind: 'travel',
      title: '顺路去山门',
      narration: [
        `${cast.herb}把检查过的幼苗重新栽好，顺手提起一只空种匣。`,
        '“新一批灵种下午到山门。正好，一起去取。”',
      ],
    },
    '01-01:root': {
      kind: 'travel',
      title: '第二日',
      narration: [
        '昨夜的山门没有任何异常。名册整齐，阵纹安静，所有人都有来处，也都有去处。',
        `第二日清晨，${cast.herb}却托人来找你：昨日刚检查过的药田边角，多了一株没有登记的灰白幼苗。`,
      ],
    },
    '01-02:archive': {
      kind: 'travel',
      title: '这不是药田能解释的事',
      narration: [
        `${cast.herb}没有给那株草起名字，只把你们刚才核对过的事实逐项写下。`,
        `“拿去给${cast.archive}看。别说它是什么，只说我们看见了什么。”`,
      ],
    },
    '01-03:spring': {
      kind: 'travel',
      title: '先离开答案一会儿',
      narration: [
        `${cast.archive}把记录压进卷底，没有立刻继续追查。`,
        '你在书库里耗了半日神识。对方看了你一眼：“先去灵眼之泉歇一阵。脑子越急，越容易把不知道的东西想成自己熟悉的样子。”',
      ],
    },
    '01-04:auction': {
      kind: 'travel',
      title: '回到日常',
      narration: [
        '离开灵眼之泉以后，陌生的水声一直留在记忆里，但你没有任何能继续查下去的线索。',
        '回城途中，拍卖行的今日寄售榜刚好刷新。你原本只打算随手看一眼。',
      ],
    },
    '01-05:black-market': {
      kind: 'travel',
      title: '灰纹与水声',
      narration: [
        '那条未来寄售消失以后，能留下的只有两个词：灰纹石片，水声。',
        '拍卖行里有人随口提起，最近暗巷也有人拿着“总是湿着的灰石”四处问价。这个线索至少是真实存在于今天的。',
      ],
    },
    '01-06:lamps': {
      kind: 'travel',
      title: '不只东西会走错来处',
      narration: [
        '急售散修交代，那块石片来自太岳山外缘：明明附近有溪，却听见一种更远、更重的潮声。',
        '你离开前，沉默老者忽然补了一句：“东西能走错来处，人也能。死人更早。”',
        actor.sectId === 'youdu'
          ? '回宗后，招魂司正好有人来找你。'
          : `${cast.archive}也在这时收到一封从幽都来的旧式传书。`,
      ],
    },
    '01-07:await-dungeon': {
      kind: 'travel',
      title: '线索第一次指向同一个地方',
      narration: [
        `${cast.archive}把“灰纹石片”“无河潮声”和那封幽都灯册放在一张案上，没有说它们必然相关。`,
        '但急售散修给出的地点足够具体：太岳山外缘，青溪灵草坡。与其再猜，不如亲自去看。',
      ],
    },
    '01-07:elder-check': {
      kind: 'travel',
      title: '先问那个不肯多说的人',
      narration: [
        '残页中央的空白不像破损，更像某段东西从“记录”本身被拿走。',
        '你想起沉默老者见到灰纹石片时的反应，决定先绕去暗巷。',
      ],
    },
    '01-07:market-check': {
      kind: 'travel',
      title: '先看它是不是“东西”',
      narration: [
        '你没有急着给残页赋予神秘意义。坊市每天给成千上万件材料归类、估价，也许它只是一种从未见过的纸。',
      ],
    },
    '01-08:letters': {
      kind: 'travel',
      title: '把残页带回去',
      narration: [
        progress.flags['story.v1.blank_page_action'] === 'elder'
          ? '沉默老者没有解释，只留下“纸不是问题。空白才是。”'
          : progress.flags['story.v1.blank_page_action'] === 'sell'
            ? '坊市鉴定阵无法把它稳定归入纸、符、残卷或杂物，价格栏始终为空。'
            : '你没有让残页再经过别人的手。',
        `无论如何，这件事都该回到${cast.archive}那里。`,
      ],
    },
    '01-09:gate': {
      kind: 'travel',
      title: '替旧朋友送三封信',
      narration: [
        `${cast.archive}把三封信封好后没有叫执事弟子，而是直接交给你。`,
        '“送到山门。别走宗门公函，按私人旧信寄。”',
        '你到山门时已经入夜。也正是在那里，守门人发现簿册多了一笔不该存在的记录。',
      ],
    },
    '01-10:pre-breakthrough': {
      kind: 'travel',
      title: '先把自己筑稳',
      narration: [
        '夜间来客没有留下可追到底的线索。再往前追，只剩猜测。',
        `与此同时，你自己的炼气修为已经走到筑基之前。${cast.cultivation}让你先把外面的事放下。`,
      ],
    },
    '01-10:await-breakthrough': {
      kind: 'await_gameplay',
      title: '接下来不是剧情按钮',
      narration: [
        '先按现有玩法完成破境卷宗、闭关与筑基。主线不会替你跳过任何真实修行条件，也不会暗中增加突破率。',
        '真正的下一幕，只会在一次真实成功的筑基之后发生。',
      ],
      dismissLabel: '继续正常修行',
    },
    '01-10:report': {
      kind: 'travel',
      title: '这一次必须告诉他',
      narration: [
        '水声断得很快，可那两句话没有随着突破余韵消失。',
        `你可以怀疑自己的判断，却不能假装没听见。你决定去找${cast.archive}，把原话一个字不改地说出来。`,
      ],
    },
  };

  const beat = beats[key];
  if (!beat) return null;
  const resolvedAction =
    key === '01-06:lamps' && actor.sectId === 'youdu'
      ? { label: '回招魂司核对灯册', href: '/game/sect/affairs' }
      : action;
  return { ...beat, action: resolvedAction };
}

function castOf(sectId: string): SectCast {
  const cast = VOLUME_ONE_SECT_CAST[sectId];
  if (!cast) {
    throw new Error(`第一卷尚未适配宗门: ${sectId}`);
  }
  return cast;
}

function choice(id: string, label: string, hint?: string): MainStoryChoice {
  return { id, label, ...(hint ? { hint } : {}) };
}

function sceneBase(
  progress: StoryProgressState,
  sceneKey: string,
  title: string,
  location: string,
  narration: string[],
  choices: MainStoryChoice[],
  lines: MainStoryScene['lines'] = [],
  kicker?: string,
): MainStoryScene {
  return {
    storyId: MAIN_STORY_V1_ID,
    version: MAIN_STORY_V1_VERSION,
    nodeId: progress.currentNodeId,
    sceneKey,
    title,
    location,
    ...(kicker ? { kicker } : {}),
    narration,
    lines,
    choices,
  };
}

export function buildExpectedScene(
  progress: StoryProgressState,
  actor: StoryActorContext,
): MainStoryScene | null {
  const cast = castOf(actor.sectId);
  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  const sceneKey = MAIN_SCENE_KEYS[key];
  if (!sceneKey || progress.status === 'completed') return null;

  switch (key) {
    case '01-00:affairs':
      return sceneBase(
        progress,
        sceneKey,
        '山门如常·执事堂',
        `${cast.label} · 宗门事务`,
        [
          '今日没有天灾，也没有大敌。执事堂里排着寻常的差事，来往弟子抱怨报酬、路远和天气。',
          '你办完手头的事情时，负责日常事务的人顺手把一枚旧木牌拨回原位。没有异象，也没有谁特意看你。',
        ],
        [choice('continue', '照常离开')],
        [{ speaker: cast.daily, text: '忙完就去看看自己的事。修行日子长，别把每一天都过成大事。' }],
        '一切都很正常。',
      );
    case '01-00:herb':
      return sceneBase(
        progress,
        sceneKey,
        '山门如常·药田',
        `${cast.label} · 宗门药田`,
        [
          '药田里灵草随风俯仰。你帮着翻看几株最普通的幼苗：茎、叶、根须都完整，土层也没有异常。',
          '负责药田的人把一株幼苗轻轻提起，细根沾着湿土，完整地垂在你眼前。',
        ],
        [choice('continue', '记下这副寻常样子')],
        [{ speaker: cast.herb, text: '根看着不起眼，可活物到底从哪儿吃水、在哪儿扎住，都瞒不过它。' }],
      );
    case '01-00:gate':
      return sceneBase(
        progress,
        sceneKey,
        '山门如常·来去有迹',
        `${cast.label} · 山门`,
        [
          '天色将暗，守门弟子把今日最后几笔出入记入簿册。名字、来处、去处，一笔不少。',
          '山门阵纹随着最后一名归宗弟子微微亮起，又归于平静。',
        ],
        [choice('continue', '回身入山')],
        [{ speaker: cast.gate, text: '山门最怕的不是人多，是来无来处，去无去处。能对得上册，就好办。' }],
      );
    case '01-01:root':
      return sceneBase(
        progress,
        sceneKey,
        '土下一寸',
        `${cast.label} · 宗门药田`,
        [
          '隔日，药田边角多出一株灰白幼苗。它没有登记，也不像任何一批新播灵种。',
          '土层被一点点拨开。主根向下延伸，正好在土下一寸处消失。不是折断，不是腐烂，也没有切口；根须只是到了那里便不再属于这块土。周围泥土完整得近乎刻意。',
          '更怪的是，它还活着。',
        ],
        [
          choice('keep', '由我暂存样本', '保留样本，后续某些细节会更容易验证。'),
          choice('handover', `交给${cast.herb}`, '更容易获得药田负责人的信任。'),
          choice('destroy', '当场毁去', '不会中断主线，但你会失去这份样本。'),
        ],
        [{ speaker: cast.herb, text: cast.rootReaction }],
      );
    case '01-02:archive':
      return sceneBase(
        progress,
        sceneKey,
        '留在纸上的根',
        `${cast.label} · 宗门传承`,
        [
          progress.flags['story.v1.root_sample_choice'] === 'keep'
            ? '灰白幼苗的样本仍由你暂存。你没有给它起任何名字，只记录它的根在土下一寸处无切口地消失。'
            : progress.flags['story.v1.root_sample_choice'] === 'handover'
              ? `${cast.herb}已经把样本单独封存，并在药田记录上明确写了“未知，不定名”。`
              : '样本已被毁去。现在能带进传承处的只剩你们当时共同核对过的观察记录。',
          `你把药田里发生的事原样讲给${cast.archive}。对方没有先问“它是什么”，而是反复核对土层、根须、影子与灵气。`,
          cast.archiveGesture,
        ],
        [
          choice('ask_person', '追问当年是谁问过'),
          choice('ask_records', '追问还有没有相似记录'),
          choice('leave', '先只记事实'),
        ],
        [
          { speaker: cast.archive, text: '不确定是好事。先记事实，别替事实补答案。' },
          { speaker: cast.archive, text: '几十年前，有人问过我一个很像的问题。' },
          { speaker: actor.playerName, text: '谁？' },
          { speaker: cast.archive, text: '一个不在这里的人。' },
        ],
      );
    case '01-03:spring':
      return sceneBase(
        progress,
        sceneKey,
        '泉中有月',
        '灵眼之泉',
        [
          '你只是来疗伤、歇息。洞顶没有裂缝，外面也不是夜里。',
          '可水声忽然拉得很远，像潮水从看不见的岸边退去。泉面映出的不是洞顶，而是一片陌生星空。星群密得反常，天边悬着两轮大小不一的月。',
          '你抬头——洞顶仍在。再低头时，泉面已经恢复成你的倒影。',
        ],
        [
          choice('report', `把所见告诉${cast.archive}`),
          choice('conceal', '暂时不说'),
          choice('joke', '当成疲惫幻觉记一笔'),
        ],
        [],
        '没有任何系统提示告诉你那是什么。',
      );
    case '01-04:auction':
      return sceneBase(
        progress,
        sceneKey,
        '三年之后',
        '拍卖行',
        [
          progress.flags['story.v1.foreign_moon_report'] === 'report'
            ? `${cast.archive}听完泉中双月的描述后没有下结论，只让你把星位和水声细节原样记住。`
            : progress.flags['story.v1.foreign_moon_report'] === 'conceal'
              ? '泉中双月的事，你暂时没有告诉任何人。'
              : '你曾把泉中双月记作一次疲惫幻觉，可那片陌生星空的细节仍清楚得不合常理。',
          `寄售栏刷新的一瞬，你看见一条属于自己的记录：卖家“${actor.playerName}”，物品“灰纹石片”。`,
          '真正不对的是时间——寄售日期比现在晚整整三年。价格不高，描述只有一句：“从水声里捞出来的。”',
          '你再眨眼，那条记录仍在；页面其他寄售都正常。',
        ],
        [
          choice('inspect', '抄下记录并细看'),
          choice('buy', '尝试购买', '这是剧情假条目，不会扣除灵石，也不会进入真实拍卖结算。'),
          choice('ignore', '不碰它，刷新页面'),
        ],
        [],
        '无论选择什么，这条记录都会在下一次刷新后消失。',
      );
    case '01-05:black-market':
      return sceneBase(
        progress,
        sceneKey,
        '不要买',
        '暗巷黑市',
        [
          progress.flags['story.v1.future_listing_action'] === 'buy'
            ? '你在拍卖行尝试购买那条“三年之后”的寄售。确认没有真正成立，也没有灵石被扣除；刷新后，记录像从未存在。'
            : progress.flags['story.v1.future_listing_action'] === 'inspect'
              ? '你还留着那条“三年之后”寄售记录的手抄：灰纹石片，从水声里捞出来的。'
              : '你没有碰那条“三年之后”的寄售，刷新后它便消失了。',
          '急售散修把一块灰纹石片压在桌面。石头是湿的，边缘挂着细小水珠；可城里已经许久没有下雨。',
          '笑面掌柜正要报数，角落里的沉默老者忽然抬眼。',
        ],
        [
          choice('buy', '买下石片', '石片只进入主线状态，不进入可交易经济库存。'),
          choice('heed', '听老者的，不买'),
          choice('hold', '让掌柜先替我压着'),
        ],
        [
          { speaker: '笑面掌柜', text: '道友来得巧。此物不问出处，只问你敢不敢接。' },
          { speaker: '沉默老者', text: '别买。' },
          { speaker: '急售散修', text: '老头，你认识？' },
          { speaker: '沉默老者', text: '不认识。' },
          { speaker: '急售散修', text: '不认识你管什么？' },
          { speaker: '沉默老者', text: '因为不该认识。' },
          { speaker: '笑面掌柜', text: '可老先生今天肯开口——这就比石头值钱。' },
          { speaker: '笑面掌柜', text: '您今天话说多了。我年轻时您就不爱说话。' },
          { speaker: '沉默老者', text: '你年轻时更烦。' },
        ],
      );
    case '01-06:lamps':
      if (actor.sectId === 'youdu') {
        return sceneBase(
          progress,
          sceneKey,
          '第十八盏灯',
          '幽都 · 招魂司旧档',
          [
            '旧册上列着十七个名字。案前却燃着十八盏魂灯。你重新数了一遍，还是十八。',
            '最末那盏火色正常，不抢眼，也没有任何异象，正因如此才更令人不安。',
            '第二天再问，多数人都笃定地说：“本来就是十八盏。”',
          ],
          [choice('remember', '先把“十七名、十八灯”记住')],
          [
            { speaker: '归魂婆婆', text: '别数灯。先数名字。' },
            { speaker: '褚先生', text: '没有第十八个名字。' },
            { speaker: '归魂婆婆', text: '所以今晚谁也别吹灭它。' },
            { speaker: '归魂婆婆', text: '你还记得，就先记着。别急着替它找名字。' },
          ],
        );
      }
      return sceneBase(
        progress,
        sceneKey,
        '第十八盏灯',
        `${cast.label} · 宗门传承`,
        [
          `${cast.archive}收到一封旧式传书。纸张很普通，封口却用了早已少见的私印方式。`,
          '信中没有解释来龙去脉，只写了一句：“幽都有一份灯册对不上。册上十七，灯十八。”',
          '对方看完后没有把信归入宗门正式档案，而是单独夹进一本私人旧册。',
        ],
        [choice('remember', '记住这句话')],
        [{ speaker: cast.archive, text: '写信的人不会拿这个开玩笑。' }],
        '你第一次确定：守档的人在别的宗门也有会谈这些事的旧识。',
      );
    case '01-07:found-page':
      return sceneBase(
        progress,
        sceneKey,
        '青溪残页',
        '太岳山·青溪灵草坡',
        [
          '正常历练已经结算。你沿溪收拾最后一处采集点时，在一块被水磨圆的旧石下摸到一页薄纸。',
          '纸边残留淡墨，中央却是一块完整空白。你试着用指尖灵力划过，痕迹刚跨进那片空白便被“抽走”，仿佛那一笔从来没有存在过。',
          progress.flags['story.v1.black_fragment_owned'] === true
            ? '储物中的灰纹石片骤然变冷。溪水声里混进了一瞬不属于山谷的远潮。'
            : '溪水声忽然多出一重遥远回音，像还有另一条河隔着很远的地方与它同时流过。',
        ],
        [
          choice('archive', `带回去交给${cast.archive}`),
          choice('elder', '先拿给沉默老者看'),
          choice('sell', '试着拿去坊市估价', '无法被正常物品分类，也不会进入真实交易。'),
        ],
      );
    case '01-07:elder-check':
      return sceneBase(
        progress,
        sceneKey,
        '青溪残页·旧物鉴家',
        '暗巷黑市',
        [
          '你把残页平放在桌上。沉默老者没有伸手，只隔着半臂看了很久。',
          '笑面掌柜想凑近，被老者用眼神挡了回去。',
        ],
        [choice('back', '带着这句话回宗门')],
        [
          { speaker: actor.playerName, text: '纸有问题？' },
          { speaker: '沉默老者', text: '纸不是问题。' },
          { speaker: actor.playerName, text: '那什么是问题？' },
          { speaker: '沉默老者', text: '空白。' },
        ],
      );
    case '01-07:market-check':
      return sceneBase(
        progress,
        sceneKey,
        '青溪残页·无法估价',
        '坊市',
        [
          '鉴定阵依次尝试把残页归入纸、符、残卷与杂物。每一次分类刚亮起，中央空白对应的阵纹便熄灭。',
          '最后，名称栏、品阶栏和估价栏一起回到空白。不是“无价”，而是系统连它属于什么都无法稳定留下。',
        ],
        [choice('back', '收回残页，回宗门传承')],
        [{ speaker: '坊市鉴定修士', text: '我干这行这么久，第一次见到鉴定阵自己把结论擦掉。' }],
      );
    case '01-08:letters':
      return sceneBase(
        progress,
        sceneKey,
        '旧信不署名',
        `${cast.label} · 宗门传承`,
        [
          `${cast.archive}把残页压在普通宣纸下描了一遍。墨迹本来清楚，越过那片空白对应的位置后却同样慢慢淡去。`,
          '这一次，对方没有再说“也许只是材料问题”。三封短笺被依次写好，封口没有宗门公印，只有私人旧识才认得的记号。',
          `笺头用的不是正式称谓，而是多年旧交之间的写法：${cast.letterAddressees}。`,
          progress.flags['story.v1.blank_page_action'] === 'elder'
            ? '你补充了沉默老者看过残页后的话：“纸不是问题。”你问什么才是问题，他只答了两个字：“空白。”'
            : progress.flags['story.v1.blank_page_action'] === 'sell'
              ? '你也说明坊市鉴定阵曾尝试给残页归类，却连“纸、符、残卷、杂物”都无法稳定判定，估价始终为空。'
              : '残页被原样带回，没有先经过别人的手。',
        ],
        [
          choice('ask', '问这些信要寄给谁'),
          choice('trust', '不追问，替他送到山门'),
        ],
        [
          { speaker: cast.archive, text: '不是纸在吞字。' },
          { speaker: cast.archive, text: '是有一段东西不肯被留下。' },
          { speaker: actor.playerName, text: '你以前见过？' },
          { speaker: cast.archive, text: '见过很像的。' },
          { speaker: actor.playerName, text: '这些信寄给谁？' },
          { speaker: cast.archive, text: '旧朋友。年轻时一起争过几本书。年纪大了，反倒只剩这些事能让人重新写信。' },
          { speaker: cast.archive, text: '我希望他们回答没有。' },
        ],
      );
    case '01-09:gate':
      return sceneBase(
        progress,
        sceneKey,
        '夜半山门',
        `${cast.label} · 山门`,
        [
          '夜里，守门人把你叫到簿册前。你昨夜离开后的下一刻，册上多了一笔出入。',
          '名字被水似的墨晕开，只剩“陆、路、鹿”一般的半个字形；来处和去处都是空白。字迹却与守门人自己的笔迹完全一致。',
          `${cast.gate}不记得写过这一笔。山门阵法也没有任何强闯或破损记录。`,
          cast.gateAnomaly,
        ],
        [
          choice('follow', '沿痕迹继续追查'),
          choice('report', `先报给${cast.archive}`),
          choice('lock', '建议封门复核一夜'),
        ],
      );
    case '01-10:pre-breakthrough':
      return sceneBase(
        progress,
        sceneKey,
        '有人吗？·入静之前',
        '静室修行',
        [
          progress.flags['story.v1.night_visitor_choice'] === 'follow'
            ? '你追过山门外的痕迹，却只把“不可能连续的足迹”带了回来。'
            : progress.flags['story.v1.night_visitor_choice'] === 'report'
              ? `${cast.archive}已经看过那笔没有来处与去处的夜间记录，但同样没有给出解释。`
              : '山门被谨慎复核了一夜。阵法、门锁、簿册都没有找到入侵痕迹。',
          '线索越来越多，却没有一条足以解释全部。你把它们暂时压下，准备按原有修行规则冲击筑基。',
          '主线不会替你跳过破境卷宗，也不会给这次突破额外成功率。',
        ],
        [choice('enter', '收心入静')],
        [{ speaker: cast.cultivation, text: cast.breakthroughAdvice }],
      );
    case '01-10:voice':
      return sceneBase(
        progress,
        sceneKey,
        '有人吗？',
        '突破后的寂静',
        [
          '突破的灵光、疼痛与喧响都退下去后，世界短暂地安静得过分。',
          '先是一阵极远的水声。然后，有谁在水声另一头试探着开口。那声音不在识海，也不像传音术。',
        ],
        [choice('listen', '凝神去听')],
        [
          { speaker: '？？？', text: '……有人吗？' },
          { speaker: '？？？', text: '能……听见吗？' },
        ],
        '声音随即断开。你确信，这一次不是幻听。',
      );
    case '01-10:report':
      return sceneBase(
        progress,
        sceneKey,
        '有人吗？·回报',
        `${cast.label} · 宗门传承`,
        [
          '你把突破后的水声和那两句话原样复述，没有加上“幻听”“异界”或任何自己的解释。',
          `${cast.archive}听完后很久没有翻页。那三封寄给旧友的信，此刻正好有一封回信压在案角，却没有拆开。`,
        ],
        [choice('finish', '记下这句话')],
        [
          { speaker: actor.playerName, text: '它问：“有人吗？”然后又问：“能听见吗？”' },
          { speaker: cast.archive, text: '这件事，先不要在外面说。' },
          { speaker: actor.playerName, text: '你相信我？' },
          { speaker: cast.archive, text: '我原本希望，那些信会回答我：没有。' },
        ],
        '第一卷到这里才真正结束。',
      );
    default:
      return null;
  }
}

export function routeAllowsExpectedScene(
  progress: StoryProgressState,
  pathname: string,
): boolean {
  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  if (key === '01-07:found-page' || key === '01-10:voice') return true;
  const routes: Record<string, string> = {
    '01-00:affairs': '/game/sect/affairs',
    '01-00:herb': '/game/sect/herb-garden',
    '01-00:gate': '/game/sect/gate',
    '01-01:root': '/game/sect/herb-garden',
    '01-02:archive': '/game/sect/archive',
    '01-03:spring': '/game/inn',
    '01-04:auction': '/game/auction',
    '01-05:black-market': '/game/black-market',
    '01-06:lamps': '/game/sect/archive',
    '01-07:elder-check': '/game/black-market',
    '01-07:market-check': '/game/market/recycle',
    '01-08:letters': '/game/sect/archive',
    '01-09:gate': '/game/sect/gate',
    '01-10:pre-breakthrough': '/game/retreat',
    '01-10:report': '/game/sect/archive',
  };
  return routes[key] === pathname;
}

function assertChoice(choiceId: string, allowed: readonly string[]): void {
  if (!allowed.includes(choiceId)) {
    throw new Error('当前卷页不接受这个选择');
  }
}

function trustKeyForNode(nodeId: string, actor: StoryActorContext): string {
  const cast = castOf(actor.sectId);
  if (nodeId === '01-01') return cast.herb;
  if (nodeId === '01-02' || nodeId === '01-06' || nodeId === '01-08') return cast.archive;
  if (nodeId === '01-09') return cast.gate;
  return '主线见闻';
}

export function resolveStoryChoice(
  progress: StoryProgressState,
  actor: StoryActorContext,
  sceneKey: string,
  choiceId: string,
): StoryTransition {
  const expected = getExpectedSceneKey(progress);
  if (!expected || expected !== sceneKey) {
    throw new Error('卷页已经变化，请刷新后再继续');
  }

  const key = `${progress.currentNodeId}:${progress.currentStep}`;
  switch (key) {
    case '01-00:affairs':
      assertChoice(choiceId, ['continue']);
      return { nodeId: '01-00', step: 'herb' };
    case '01-00:herb':
      assertChoice(choiceId, ['continue']);
      return { nodeId: '01-00', step: 'gate' };
    case '01-00:gate':
      assertChoice(choiceId, ['continue']);
      return {
        nodeId: '01-01',
        step: 'root',
        setFlags: { 'story.v1.prologue_done': true },
      };
    case '01-01:root':
      assertChoice(choiceId, ['keep', 'handover', 'destroy']);
      return {
        nodeId: '01-02',
        step: 'archive',
        setFlags: {
          'story.v1.root_anomaly_seen': true,
          'story.v1.root_sample_choice': choiceId,
        },
        trustDelta: choiceId === 'handover' ? { [trustKeyForNode('01-01', actor)]: 1 } : undefined,
      };
    case '01-02:archive':
      assertChoice(choiceId, ['ask_person', 'ask_records', 'leave']);
      return {
        nodeId: '01-03',
        step: 'spring',
        trustDelta: choiceId === 'leave' ? { [trustKeyForNode('01-02', actor)]: 1 } : undefined,
      };
    case '01-03:spring':
      assertChoice(choiceId, ['report', 'conceal', 'joke']);
      return {
        nodeId: '01-04',
        step: 'auction',
        setFlags: {
          'story.v1.foreign_moon_seen': true,
          'story.v1.foreign_moon_report': choiceId,
        },
      };
    case '01-04:auction':
      assertChoice(choiceId, ['inspect', 'buy', 'ignore']);
      return {
        nodeId: '01-05',
        step: 'black-market',
        setFlags: {
          'story.v1.future_listing_seen': true,
          'story.v1.future_listing_action': choiceId,
        },
      };
    case '01-05:black-market':
      assertChoice(choiceId, ['buy', 'heed', 'hold']);
      return {
        nodeId: '01-06',
        step: 'lamps',
        setFlags: {
          'story.v1.black_fragment_seen': true,
          'story.v1.black_fragment_owned': choiceId === 'buy',
          'story.v1.silent_elder_warning': true,
        },
      };
    case '01-06:lamps':
      assertChoice(choiceId, ['remember']);
      return {
        nodeId: '01-07',
        step: 'await-dungeon',
        setFlags: {
          'story.v1.eighteenth_lamp': actor.sectId === 'youdu' ? 'seen' : 'heard',
        },
        trustDelta: { [trustKeyForNode('01-06', actor)]: 1 },
      };
    case '01-07:found-page':
      assertChoice(choiceId, ['archive', 'elder', 'sell']);
      return {
        nodeId: choiceId === 'archive' ? '01-08' : '01-07',
        step:
          choiceId === 'archive'
            ? 'letters'
            : choiceId === 'elder'
              ? 'elder-check'
              : 'market-check',
        setFlags: {
          'story.v1.blank_page_found': true,
          'story.v1.blank_page_action': choiceId,
        },
      };
    case '01-07:elder-check':
    case '01-07:market-check':
      assertChoice(choiceId, ['back']);
      return { nodeId: '01-08', step: 'letters' };
    case '01-08:letters':
      assertChoice(choiceId, ['ask', 'trust']);
      return {
        nodeId: '01-09',
        step: 'gate',
        setFlags: { 'story.v1.archive_network_hint': true },
        trustDelta: choiceId === 'trust' ? { [trustKeyForNode('01-08', actor)]: 1 } : undefined,
      };
    case '01-09:gate':
      assertChoice(choiceId, ['follow', 'report', 'lock']);
      return {
        nodeId: '01-10',
        step: 'pre-breakthrough',
        setFlags: { 'story.v1.night_visitor_choice': choiceId },
        trustDelta: choiceId === 'lock' ? { [trustKeyForNode('01-09', actor)]: 1 } : undefined,
      };
    case '01-10:pre-breakthrough':
      assertChoice(choiceId, ['enter']);
      return {
        nodeId: '01-10',
        step: isFoundationOrAbove(actor.realm) ? 'voice' : 'await-breakthrough',
        eventPayload: isFoundationOrAbove(actor.realm) ? { catchUp: true } : undefined,
      };
    case '01-10:voice':
      assertChoice(choiceId, ['listen']);
      return {
        nodeId: '01-10',
        step: 'report',
        setFlags: { 'story.v1.first_voice_heard': true },
      };
    case '01-10:report':
      assertChoice(choiceId, ['finish']);
      return {
        nodeId: '01-10',
        step: 'complete',
        status: 'completed',
        completed: true,
      };
    default:
      throw new Error('当前卷页需要先完成指定玩法事件');
  }
}

export function isFoundationOrAbove(realm: string): boolean {
  const order = ['炼气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'];
  const index = order.indexOf(realm);
  return index >= order.indexOf('筑基');
}

export function applyFlagPatch(flags: StoryFlags, patch?: StoryFlags): StoryFlags {
  return patch ? { ...flags, ...patch } : { ...flags };
}

export function applyTrustDelta(
  trust: StoryNpcTrust,
  delta?: Record<string, number>,
): StoryNpcTrust {
  const next = { ...trust };
  if (!delta) return next;
  for (const [npc, amount] of Object.entries(delta)) {
    next[npc] = Math.max(0, Math.min(3, (next[npc] ?? 0) + amount));
  }
  return next;
}
