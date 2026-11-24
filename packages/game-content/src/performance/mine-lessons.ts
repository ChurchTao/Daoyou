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
      describe('你抱着咪咪赶到院门口，钟还没响完。木人一拳打裂了盾，举盾的少年退到红线外，手里只剩半块木板。'),
      say('peer', '到红线就停了。把猫放我边上吧。'),
      describe('木人在红线前站住了。教习叫来两名佩剑的弟子。先下场的等它举盾一撞，侧身让开，一剑递进它肩下。教习喊停时，木拳还悬在他头边。'),
      describe('第二人朝盾沿连递两剑，木人刚把盾抵紧，第三剑已经劈下去，震得它退了一步。'),
      say('teacher', '照头一个那么等，剑什么时候出，得看对方肯露多大的空当。这路叫斩尘证道。想自己把盾逼开，就学万剑归一。'),
    ],
    practice: [
      describe('你刚握紧木剑，引来的气就散了。教习给你指了个齐肩高的木桩。'),
      say('teacher', '手松开些。第一下省一点，劲留到第三下。'),
      describe('头一剑轻得你差点又往手上使劲。等第二剑也落准了，你才敢把剩下那口气全送出去。第三剑劈进旧痕，震得你差点握不住剑。'),
    ],
    note: '第三剑落下去，手都还麻着。对上木人，出完剑记得退开。',
    request: '轮到我，替我看看哪只脚先退。我一退，盾就举偏了。',
  },
  wuxiang: {
    method: '《无相本心经》',
    moves: '破妄指',
    demo: [
      describe('莲池边，有个少年让木人打落了练功棍。他伸手去捞，木人又抡了一拳。他慌着避开，手背在池沿擦破了。教习叫停木人。'),
      describe('师兄在少年腕上结了道印，转身又去给旁边的人看伤。少年还张着手等上药，低头一看，血已经止了。'),
      describe('教习叫另一人去捡棍。木人还是那一拳。那人侧身带开它的肘，顺势一拳打在肋下，随即扶住险些歪进池里的木架。这才腾出手去捞棍。'),
      say('teacher', '想学前头治伤的法子，选佛心济世。魔心修罗练的是后头那一手，你再想想他刚才是怎么挡开木拳的。'),
    ],
    practice: [
      describe('你想引气引得快些，肩背跟着往上抬。教习按着你的肩，等你喘匀，才从手边抽出《般若照见经》，翻到一幅并指的图。'),
      describe('你照着图往前一送。离指尖还有半寸，练功板就响了。收手再看，一点凹痕正落在你刚才瞄的地方。'),
    ],
    note: '隔着半寸就能点到。打木人时，先瞄准它身上的一处，别跟着拳头乱转。',
    request: '轮到我时帮我看一下手。刚才也说不准，是它先碰着我，还是我自己先躲了。',
  },
  tianyan: {
    method: '《五气朝元》',
    moves: '森罗缚、焚天流火',
    demo: [
      describe('一个少年端着阵石从场边过。前头的木人让藤缠了脚，他还当能过去，后头那只已经从旁边追上来，险些把他手里的盘子撞翻。'),
      describe('放藤的师姐腕上还有道青印。教习给她摆了两块木靶，请她接一手火。她一抬手，两块靶同时冒烟，青印也换成了火色。'),
      describe('轮到另一人，教习给木人罩了层护光。那人也先放藤，再从手里送出一道白芒。护光当场散了，铜箍上留着一道浅印。'),
      say('teacher', '前面那位是衍法天师。执衡真君也能借那道木印，只是这位看木人护得严，先用金法拆了它的护光。'),
    ],
    practice: [
      describe('教习往你手心放了截枯藤。掌心刚有一点热，你就急着往外推，藤梢只动了动。'),
      say('teacher', '等它缠住了，看看手腕。木印出来，再接火。'),
      describe('再试时，枯藤绕住了练功柱的木脚。你松开手，腕上还有一点青色。教习把《草木知春》和《星火燎原》并在案上，叫你翻到画着那道印的地方。'),
    ],
    note: '两只一起来，先拿森罗缚绊住快的那只。等腕上有了木印，再用焚天流火。',
    request: '我想先用火。你在外头替我瞧瞧，哪只木人先钻出来。',
  },
  youdu: {
    method: '《渡黄泉》',
    moves: '摄魂',
    demo: [
      describe('一个少年刚举好盾，就给木人一拳砸得坐在地上。教习扶他起来，压好木人胸口的纸符，叫他站到原来的砖上，再挡一次。'),
      describe('这回木人抬手前，教习先朝它胸口送了一道气。纸符上的墨晕开了，拳头照样落下来。少年只退了一小步，趁木人收拳，用盾沿一顶，木人肩头的护片应声裂了。'),
      describe('有个弟子用滞魂咒拖住木人，等步子慢了才过去。另一人打出一抹血影，退开老远，符上的黑斑还在往边角爬。'),
      say('teacher', '先下场的练拘魂锁命，后一个练蚀魂摧形。你想先练哪手？'),
    ],
    practice: [
      describe('你头一回只顾着往远处够，木人胸前的纸角一抖，墨迹还在原处。教习叫你看准中间那一竖再松手。'),
      describe('再试时，黑墨沿纸纹散开，像一滴水落在了笔画上。你走到它跟前，那团湿痕还在。'),
    ],
    note: '木人中了摄魂还能出拳。挡过头一拳就能回手，那时它挨打也比平常疼。',
    request: '我举起盾就老想多等一拳。下午我要又错过了，出来你跟我说。',
  },
  jiujie: {
    method: '《九劫天书》',
    moves: '引雷斩、天罡护体',
    demo: [
      describe('你还在台阶下，便听院里炸了一声。一个少年跑出来，把刀往门边一靠。刀尖焦了一块，他先低头瞧了瞧自己的鞋。'),
      say('peer', '我一提刀，雷就往脚边跑。鞋倒还在。'),
      describe('教习叫那少年先把焦刀搁下。场里有人沿刀背引雷，等木人把盾一抬，一刀震松了盾上的铜钉。另一人空着手，在最远那块木靶上劈下一道雷。'),
      say('teacher', '想把雷接到兵刃上，学霹雳真君。你若想站在这儿，让雷劈到院子那头，选踏雷天尊。'),
    ],
    practice: [
      describe('你刚抬起练刀，手腕就麻了，险些把刀扔掉。教习叫你把刃放低，朝前摆正再引。'),
      describe('电光这才走到刀尖，在面前的练功板上留了一道焦印。教习把《混天雷法》递过来，叫你认一认那道雷的走向。'),
    ],
    note: '引雷斩能扫到近旁的木人。两只一齐逼过来，来不及出刀就先护身，用天罡护体。',
    request: '我盯着刀尖就顾不上脚。你替我瞧瞧，雷是落刀时跑偏的，还是我提刀时人就站歪了？',
  },
  bailu: {
    method: '《白鹿正学》',
    moves: '破邪、复元',
    demo: [
      describe('你绕过松庭的长案时，一个少年正朝木人喊停。他退到案边，撞歪了案子。你扶住砚台，站在案旁的师兄也朝木人转过身。'),
      say('senior', '罢兵！'),
      describe('木拳停在少年头顶，教习叫他从底下出来。下一位师兄朝右边的木人一点，它胸前便多了一道朱批。等他喊出「破邪」，右边挨了一记，左边的也跟着晃了晃。'),
      say('teacher', '刚才喊停那位学的是正言执律。浩气文章还可以点名，先找准要对付的那个，再开口。'),
    ],
    practice: [
      describe('你读得响，到后半句却没剩多少气，收尾那个字含在嘴里。教习抽出《正气长歌》，只叫你照着念「破邪」。'),
      say('teacher', '第一个字轻些，我听得见。留到第二字，再把气吐完。'),
      describe('你照说一遍，练功木牌上那枚纸符被最后一个字掀掉了。你弯腰去捡，案上还摊着讲如何调回气血的《养气存诚》。'),
    ],
    note: '要试破邪，先看准木人再开口。挨了拳想缓一缓，就用《养气存诚》里的复元。',
    request: '我若上场，替我听听「邪」字有没有喊出来。刚才木拳一到跟前，我就忘了开口。',
  },
  wanqiao: {
    method: '《听万窍》',
    moves: '裂帛',
    demo: [
      describe('你刚到溪边，竹屋里就响了一声磬。一个少年正在纸上记木人的步子，听见三处铜片齐响，提笔就画了三道。'),
      say('teacher', '再看一眼，中间那只动过。其余两片是磬震响的。'),
      describe('另一名弟子举起短笛，只朝一只木人吹了一声。等那木人走出两步，挨过一下的肩窝又闷闷地响了。'),
      say('teacher', '磬是天籁一路的，一声能送出去这么远。你若想让那一声只落在你点的地方，就学入微。'),
    ],
    practice: [
      describe('教习叫你背过身，在篱笆后敲了两下竹管。第一下你指错了，第二下才听出声从溪面折回来，竹管其实在右手。'),
      describe('轮到你送一声，教习用《风入松》压住蒙在练习板上的布。头一回布只颤了颤。你认准绷得最紧的地方再送一声，布裂开一截，短得你几乎没听见尾音。'),
    ],
    note: '想用裂帛打矮的那只，先听脚步。它绕到盾后，脚下照样有声。',
    request: '里头回声一大，我分不清打中了没有。待会儿你在外头替我听一耳朵。',
  },
  xiaoyue: {
    method: '《百兽化形》',
    moves: '虎扑',
    demo: [
      describe('有个少年撑着膝盖站起来。老猿把木人搬回原处，替他捡起护臂。你怀里的咪咪探出头，还在看木人晃着的手。'),
      say('teacher', '正好，看看它怎么扑。'),
      describe('教习拎了截旧绳在地上拖。咪咪肚子伏得快贴到地上，等绳头一动，后腿一蹬，前爪已把绳压住。'),
      describe('场里两个弟子各走了一遍。一个腿上浮起兽形，扑得木人双脚离地。另一个扑过去时给身侧留出半步，一头灰背灵兽跟了上去，也一掌拍在木人的胳膊上。'),
      say('teacher', '头一个练百相化形，借的是灵兽的身手。后一个跟自己的灵兽一道练，叫灵兽同契。你想和咪咪一块儿动手，可以先看看这路。'),
    ],
    practice: [
      describe('头一回你学咪咪往前扑，身子还没压低，后脚就蹬了出去。教习叫你重来，等脚掌踩实了再蹬。'),
      describe('这回你一蹬，两手已经推在木桩上。木桩往后滑过一道旧划痕。你回头看咪咪，绳还压在它爪子底下，后腿正抵着台阶。'),
    ],
    note: '后脚踩实了再扑。若带灵兽上场，记得给它留出地方。',
    request: '刚才我险些扑到地上。你待会儿帮我看看，到底是手快了，还是脚快了？',
  },
};

const cast = {
  player: { name: '你' },
  teacher: { name: '{instructor}' },
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
    requires: ['instructor'],
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
    requires: ['instructor', 'archive_name', 'archive_keeper'],
    cast,
    cues: [
      scene,
      { type: 'title', kicker: '早课', text: '去读本门心法' },
      say(
        'teacher',
        `御风也得先学会运气。去{archive_name}找{archive_keeper}，先拿${lesson?.method ?? '主心法'}。`,
      ),
      describe('教习交代你先把本门六卷心法各练到十级，再回来试招。'),
      { type: 'end', outcome: 'done' },
    ],
  });
  const form = parsePerformanceScript({
    id: 'mine-lesson-form',
    title: '试试起手',
    requires: ['instructor'],
    cast,
    cues: [
      scene,
      { type: 'title', text: '试试起手' },
      ...(lesson
        ? [
            say('teacher', '来，照你在阁里练的法子运气。等要出手了再用这口气。'),
            ...lesson.practice,
            { type: 'letter', title: lesson.moves, text: lesson.note },
          ]
        : []),
      say(
        'teacher',
        '下午开木人场。你想拿刚才那招试手，就在簿上写个名字。',
      ),
      describe('那个少年先写了名字，把簿子和笔一并递给你。'),
      say('peer', '你住缺角门槛那间吧？我住隔壁。下午你上场，我给你看着。'),
      say('peer', lesson?.request ?? '轮到我时，也替我瞧瞧怎么出的手。'),
      describe('你接过笔，在少年那一行下头写了名字。'),
      { type: 'end', outcome: 'done' },
    ],
  });
  return [morning, studyBrief, form];
}
