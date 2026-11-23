import {
  parsePerformanceScript,
  type PerformanceCue,
} from '@daoyou/game-domain/performance';
import type { CombatV6SectId } from '@daoyou/game-domain/combat';
import { getMountainGateBackdrop } from './mountain-gate-arrivals.js';

export const describe = (text: string) => ({ type: 'narration', text } as const);
export const say = (speaker: string, text: string) =>
  ({ type: 'line', speaker, text } as const);

interface MorningLesson {
  method: string;
  moves: string;
  demo: PerformanceCue[];
  practice: PerformanceCue[];
  note: string;
  request: string;
}

export const morningLessons: Record<CombatV6SectId, MorningLesson> = {
  lingxiao: {
    method: '《红尘问心》',
    moves: '断尘',
    demo: [
      describe('早课的钟还在响。你抱着咪咪赶到院门口，正瞧见一个木人一拳打裂了盾。举盾的少年连退几步，手里只剩半块木板。'),
      say('peer', '到红线就停了。把猫放我边上吧。'),
      describe('木人的脚尖果然停在线内。教习叫出两名佩剑的弟子。先下场的等木人挺盾往前撞，才侧过身，一剑抵进它肩下的缝。收手时，木拳正悬在他头边。'),
      describe('第二人朝盾沿连递两剑，木人刚把盾抵紧，第三剑已经劈下去，震得它退了一步。'),
      say('teacher', '前一个学斩尘证道，专等对手露空当。后一个学万剑归一，要让他接着打，后面的剑还会沉。'),
    ],
    practice: [
      describe('你刚握紧木剑，引来的气就散了。教习给你指了个齐肩高的木桩。'),
      say('teacher', '手松开些。第一下省一点，劲留到第三下。'),
      describe('第一剑落得轻，你险些跟着补劲。等第二剑也落在原处，那口气还在。你这才往手上送足力，第三剑劈进旧痕里，连剑尖也给带得往下一沉。'),
    ],
    note: '三剑连落，越往后越重。出过断尘，常要缓一口气。下午木人还会抡拳，给自己留个能退的地方。',
    request: '轮到我，替我看看哪只脚先退。我一退，盾就举偏了。',
  },
  wuxiang: {
    method: '《无相本心经》',
    moves: '破妄指',
    demo: [
      describe('你到莲池边时，一个少年正伸手捞练功棍。棍子才掉进水里，木人的拳又到了。他闪得太急，手背在池沿上擦破了一块。'),
      describe('一位师兄先在他腕上结了道印，又去给旁边等敷药的弟子治伤。少年低头一看，自己手背上的血已经止住了。'),
      describe('教习叫另一人去捡棍。木人还是那一拳。那人侧身带开它的肘，顺势一拳打在肋下，随即扶住险些歪进池里的木架。这才腾出手去捞棍。'),
      say('teacher', '治伤的是佛心济世。捡棍的是魔心修罗，先拨开它的手，才打得到肋下。'),
    ],
    practice: [
      describe('你想引气引得快些，肩背跟着往上抬。教习按着你的肩，等你喘匀，才从手边抽出《般若照见经》，翻到一幅并指的图。'),
      describe('你照着图往前一送。离指尖还有半寸，练功板就响了。收手再看，一点凹痕正落在你刚才瞄的地方。'),
    ],
    note: '并指可隔空点中一名对手。下午那两只会走，眼睛别追着它抡起来的手，先看准你要打哪儿。',
    request: '下午替我看看成么？我那只手到底是挨了一下才缩的，还是还没挨着就缩了？',
  },
  tianyan: {
    method: '《五气朝元》',
    moves: '森罗缚、焚天流火',
    demo: [
      describe('两只木人一前一后走来。一个少年端着一盘阵石等着过。前头那只忽然让藤缠了脚，后头那只从它身侧追上来，险些撞翻他手里的盘子。'),
      describe('放藤的师姐腕上还有道青印。教习给她摆了两块木靶，请她接一手火。她一抬手，两块靶同时冒烟，青印也换成了火色。'),
      describe('轮到另一人，教习给木人罩了层护光。那人也先放藤，再从手里送出一道白芒。护光当场散了，铜箍上留着一道浅印。'),
      say('teacher', '衍法天师借木起火。执衡真君见对手护得严，就接一手金法，把那层护光拆了。'),
    ],
    practice: [
      describe('教习往你手心放了截枯藤。掌心刚有一点热，你就急着往外推，藤梢只动了动。'),
      say('teacher', '等它缠住了，看看手腕。木印出来，再接火。'),
      describe('再试时，枯藤绕住了练功柱的木脚。你松开手，腕上还有一点青色。教习把《草木知春》和《星火燎原》并在案上，叫你翻到画着那道印的地方。'),
    ],
    note: '用森罗缚拖慢一只木人，腕上便有木印。焚天流火本就能冲着几只去。这场只有两只，借木印放火，烧得更重。',
    request: '我打算头一手就放火。你替我看着，火落下去以后，究竟哪只还能赶到我跟前。',
  },
  youdu: {
    method: '《渡黄泉》',
    moves: '摄魂',
    demo: [
      describe('教习把木人胸口的纸符压平。场里一个少年举盾站好，一拳就给砸得坐在地上。教习扶他起来，叫他拿好盾，站回刚才那块砖。'),
      describe('这回木人抬手前，教习先朝它胸口送了一道气。纸符上的墨晕开了，拳头照样落下来。少年只退了一小步，趁木人收拳，用盾沿一顶，木人肩头的护片应声裂了。'),
      describe('有个弟子用滞魂咒拖住木人，等步子慢了才过去。另一人打出一抹血影，退开老远，符上的黑斑还在往边角爬。'),
      say('teacher', '先下场的练拘魂锁命，后一个练蚀魂摧形。你想先练哪手？'),
    ],
    practice: [
      describe('你头一回只顾着往远处够，木人胸前的纸角一抖，墨迹还在原处。教习叫你看准中间那一竖再松手。'),
      describe('再试时，黑墨沿纸纹散开，像一滴水落在了笔画上。你走到它跟前，那团湿痕还在。'),
    ],
    note: '摄魂落在对手身上时，它打你轻些，你回手能打进去些。符黑了，它的拳还会来。',
    request: '下午举盾的那只拳重。你替我看看，我是趁它中了招就还手，还是抱着盾又多等了一拳？',
  },
  jiujie: {
    method: '《九劫天书》',
    moves: '引雷斩、天罡护体',
    demo: [
      describe('你还在台阶下，便听院里炸了一声。一个少年跑出来，把刀往门边一靠。刀尖焦了一块，他先低头瞧了瞧自己的鞋。'),
      say('peer', '我一提刀，雷就往脚边跑。鞋倒还在。'),
      describe('教习留了焦刀给新人看。持刀的弟子把电光引过刀背，等木人抬盾才一刀压下去，连盾上的铜钉都给震松了。另一人空手引雷，隔得最远的那块木靶也留下了焦痕。'),
      say('teacher', '霹雳真君接雷入兵，刀势沉了压得住。踏雷天尊要雷从指定的地方下来，靶离得远也打得到。'),
    ],
    practice: [
      describe('你刚抬起练刀，手腕就麻了，险些把刀扔掉。教习叫你把刃放低，朝前摆正再引。'),
      describe('电光这才走到刀尖，在面前的练功板上留了一道焦印。教习把《混天雷法》递过来，叫你认一认那道雷的走向。'),
    ],
    note: '引雷斩落下时能殃及近旁的敌手。出刀后手上虚，别硬接木拳。怕两只一齐上来，也可以先用天罡护体。',
    request: '我盯着刀尖就顾不上脚。你替我瞧瞧，雷是落刀时跑偏的，还是我提刀时人就站歪了？',
  },
  bailu: {
    method: '《白鹿正学》',
    moves: '破邪、复元',
    demo: [
      describe('你绕过松庭的长案时，一个少年正朝木人喊停。他退到案边，撞歪了案子。你扶住砚台，站在案旁的师兄也朝木人转过身。'),
      say('senior', '罢兵！'),
      describe('木拳就停在少年头顶。教习让他出来，再叫木人站回原处。另一位师兄喊了声「点名」，右边的木人胸前浮起一道朱批。他再喊「破邪」，右边先挨了一记，左边的也晃了晃。'),
      say('teacher', '第一位走正言执律，叫对手的招出不来。第二位学浩气文章，一声能打到两处，先打谁由他定。'),
    ],
    practice: [
      describe('你读得响，到后半句却没剩多少气，收尾那个字含在嘴里。教习抽出《正气长歌》，只叫你照着念「破邪」。'),
      say('teacher', '第一个字轻些，我听得见。留到第二字，再把气吐完。'),
      describe('你照说一遍，练功木牌上那枚纸符被最后一个字掀掉了。你弯腰去捡，案上还摊着讲如何调回气血的《养气存诚》。'),
    ],
    note: '破邪要认准对手。学浩气文章时一声能打到两只。挨了拳还抽得出空，可用复元调回气血。',
    request: '我下午也试试破邪。你在外头替我听听，最后那个字说全了没有？',
  },
  wanqiao: {
    method: '《听万窍》',
    moves: '裂帛',
    demo: [
      describe('你刚到溪边，竹屋里就响了一声磬。一个少年正在纸上记木人的步子，听见三处铜片齐响，提笔就画了三道。'),
      say('teacher', '刚才走的是中间那只。棚下那两个脚都没抬，铜片是叫磬声震响的。'),
      describe('另一名弟子举起短笛，只朝一只木人吹了一声。等那木人走出两步，挨过一下的肩窝又闷闷地响了。'),
      say('teacher', '前一个学天籁，一声能送到三处。后一个学入微，木人都走远了，声音还留在它身上。'),
    ],
    practice: [
      describe('教习叫你背过身，在篱笆后敲了两下竹管。第一下你指错了，第二下才听出声从溪面折回来，竹管其实在右手。'),
      describe('轮到你送一声，教习用《风入松》压住蒙在练习板上的布。头一回布只颤了颤。你认准绷得最紧的地方再送一声，布裂开一截，短得你几乎没听见尾音。'),
    ],
    note: '把一声送到一只木人身上，有时还会再响。隔着盾也能听见木脚。想打矮的，先听清它走到哪儿了。',
    request: '你替我听着，待会儿第一声究竟打在木人身上，还是又让石壁给送回来了？',
  },
  xiaoyue: {
    method: '《百兽化形》',
    moves: '虎扑',
    demo: [
      describe('有个少年正扶着膝盖站起来。一头老猿两臂抱住木人的腰，把它搁回起头那块砖，又给少年捡回掉在地上的护臂。咪咪看见木人的手还晃着，从你臂弯里探出半截身子。'),
      say('teacher', '正好，看看它怎么扑。'),
      describe('教习拎了截旧绳在地上拖。咪咪肚子伏得快贴到地上，等绳头一动，后腿一蹬，前爪已把绳压住。'),
      describe('场里两个弟子各走了一遍。一个腿上浮起兽形，扑得木人双脚离地。另一个扑过去时给身侧留出半步，一头灰背灵兽跟了上去，也一掌拍在木人的胳膊上。'),
      say('teacher', '想把兽的身手练到自己身上，学百相化形。想跟自己的灵兽一道练，就走灵兽同契。'),
    ],
    practice: [
      describe('头一回你学咪咪往前扑，身子还没压低，后脚就蹬了出去。教习叫你重来，等脚掌踩实了再蹬。'),
      describe('这回你一蹬，两手已经推在木桩上。木桩往后滑过一道旧划痕。你回头看咪咪，绳还压在它爪子底下，后腿正抵着台阶。'),
    ],
    note: '虎扑是借后脚的力打向一个对手。咪咪若跟你上场，等它也站好了再动。',
    request: '我早上险些扑到地上，还当是蹬早了。下午你帮我看清，是手先出去的，还是脚先蹬的？',
  },
};

const cast = {
  player: { name: '你' },
  teacher: { name: '{path_teacher}' },
  senior: { name: '师兄' },
  peer: { name: '隔壁同门' },
};

export function mineLessonScripts(sectId?: CombatV6SectId) {
  const lesson = sectId ? morningLessons[sectId] : undefined;
  const scene = {
    type: 'scene',
    alt: '山门 · 练功院',
    src: sectId ? getMountainGateBackdrop(sectId) : undefined,
  } as const;
  const morning = parsePerformanceScript({
    id: 'mine-lesson-morning',
    title: '先学哪一路',
    requires: ['path_teacher'],
    cast,
    cues: [
      scene,
      { type: 'title', kicker: '早课', text: '先学哪一路' },
      ...(lesson?.demo ?? [
        describe('早课的钟响过，教习正在院里等新人。场边一个少年给咪咪让了块空台阶。'),
      ]),
      { type: 'end', outcome: 'done' },
    ],
  });
  const studyBrief = parsePerformanceScript({
    id: 'mine-lesson-study-brief',
    title: '去读本门心法',
    requires: ['path_teacher', 'archive_name', 'archive_keeper'],
    cast,
    cues: [
      scene,
      { type: 'title', kicker: '早课', text: '去读本门心法' },
      say(
        'teacher',
        `既选定了，就去{archive_name}找{archive_keeper}。主心法${lesson?.method ?? ''}若还只在初阶，就在那里研习一级。带好灵石，练成后回来，我看你的起手。`,
      ),
      { type: 'end', outcome: 'done' },
    ],
  });
  const form = parsePerformanceScript({
    id: 'mine-lesson-form',
    title: '下午再试',
    requires: ['path_teacher'],
    cast,
    cues: [
      scene,
      { type: 'title', kicker: '早课', text: '下午再试' },
      ...(lesson
        ? [
            say('teacher', '在阁里运过一遍气了吧？到我跟前来，把那口气留到起手。'),
            ...lesson.practice,
            { type: 'letter', title: lesson.moves, text: lesson.note },
          ]
        : []),
      say('teacher', '下午放两只木人。高的举盾，矮的跑得快。想试的，在簿上留个名。'),
      describe('那个少年先写了名字，把簿子和笔一并递给你。'),
      say('peer', '我就住你隔壁。你下午上场，我也留下看。'),
      say('peer', lesson?.request ?? '轮到我时，也替我瞧瞧怎么出的手。'),
      describe('你往棚里看，举盾的木人背后果然还站着一个，两手空着。你接过笔，紧挨着少年写下自己的名字。'),
      { type: 'end', outcome: 'done' },
    ],
  });
  return [morning, studyBrief, form];
}
