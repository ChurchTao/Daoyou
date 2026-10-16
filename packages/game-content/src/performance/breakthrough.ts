import type { BreakthroughChallengeId } from '@daoyou/game-domain/combat/challenges';
import {
  parsePerformanceScript,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';

const encounters = {
  foundation_qi: {
    title: '伏息筑基',
    name: '伏息石蟾',
    threshold: '炼气圆满 · 筑基门前',
    place: '静室灯火未动，丹田深处却传来一声沉闷的蟾鸣。',
    opening:
      '筑基丹的药力沿经脉落入丹田。散乱多年的灵气开始下沉，唯有一团灰沉浊息不肯归位，反把周围的清气压得倒卷。',
    revelation:
      '浊息渐渐伏成一只石蟾。那是你炼气时未曾炼净的沉积，平日混在气息里，凝筑道基时才显出重量。若任它占住根基，筑下的便是一座浮台。',
    line: '气可借来，根基却只能自己站稳。你承得住么？',
    response:
      '你收住急于冲关的念头，将平日修过的心法一遍遍运转。石蟾抬起前足，丹田随之震动；压过这股浊息，清气才有落脚之处。',
    preparation:
      '先将基础属性分配妥当，备齐同阶道装、研习心法，并调养气血与灵力。此战重在稳住根基。',
  },
  core_condensation: {
    title: '离火凝丹',
    name: '离火丹螭',
    threshold: '筑基圆满 · 金丹门前',
    place: '丹田如炉，一缕赤色火意绕着尚未成形的丹胚游走。',
    opening:
      '灵液向一点收拢，丹胚初结。每一次压缩都挤出一线躁火，它们没有散去，反沿丹胚首尾相衔，盘成一条无角的螭影。',
    revelation:
      '离火丹螭由凝丹时逸散的火意所化。火候不足，丹胚便散；一味催逼，又会引火焚炉。你须亲手收服这道火，才能让灵力凝成自己的金丹。',
    line: '你敢催我成丹，可敢受我一焚？',
    response:
      '螭影张口，赤焰映亮经脉。你护住丹胚，循着心法的节律与它周旋，等它换气的那一瞬，将外泄的火意逐寸收回。',
    preparation:
      '同阶道装与心法都需跟上修为。准备好持续作战的灵力，别只顾催攻而让丹火拖垮自身。',
  },
  heart_demon_nascent: {
    title: '照妄问婴',
    name: '照妄影',
    threshold: '金丹圆满 · 元婴门前',
    place: '识海无风，一道蜷坐的人影守在金丹将裂未裂的地方。',
    opening:
      '金丹裂开第一道细纹时，往日未曾出口的恐惧一齐涌来。那道人影穿着你熟悉的衣袍，胸前却空无一物。',
    revelation:
      '碎丹结婴，需要让元神离开旧日庇护。照妄影便是你对失去修为、寿元与身份的惧意，它借着裂隙拦住新生的元婴，劝你永远留在此刻。',
    line: '守着这一颗金丹不好么？再往前一步，谁来保证你还是你？',
    response:
      '清心药力缓缓沉入识海。你没有驱散那些记忆，只将目光从影子的空洞中移开，握住自己这些年真正修成的东西。它终于站起，挡住去路。',
    preparation:
      '心魔会消磨气势。将装备、心法与灵兽配合好，以稳定攻守渡过纠缠。',
  },
  tribulation_deity: {
    title: '雷鹤叩神',
    name: '叩神雷鹤',
    threshold: '元婴圆满 · 化神门前',
    place: '元神探出识海，苍穹在一声长唳中低垂。',
    opening:
      '你第一次以元神触碰天地。原本沉寂的云气忽然向内卷起，聚出一只长喙雷鹤，双翼收拢，目光钉住你的神魂。',
    revelation:
      '化神要让元神与天地相接，天地的雷意也会沿这条路反灌而来。叩神雷鹤是第一股反冲的形体；若连它的叩问也承不住，元神便只能退回肉身。',
    line: '一念欲及天地，先答这一声雷。',
    response:
      '护脉药力稳住肉身，清心药力护住识海。雷鹤缓缓张翼，你将神念收束成线，迎着那道将落未落的雷声向前。',
    preparation:
      '雷意来势集中。养成防护与续航，保持完整气血，给关键回合留下应对余地。',
  },
  law_insight_void: {
    title: '断碑缚虚',
    name: '缚虚断碑',
    threshold: '化神圆满 · 炼虚门前',
    place: '前方的空处裂开一线，三块断碑从同一只石环中穿过。',
    opening:
      '感悟积至此刻，你终于察觉灵气流转之外的间隙。一圈残缺石环悬在间隙里，断碑的上下两截却分落在不同方向。',
    revelation:
      '缚虚断碑是你触及的第一道空间法则所留下的阻滞。炼虚要借用虚空，先得在错乱的距离里维持自己的法度；只凭灵力硬撞，反会被卷入碎隙。',
    line: '近未必能至，远未必可避。你的道，落在哪里？',
    response:
      '你以感悟辨认每次石环转动的间隔，将呼吸与出手重新连在一起。断碑合拢，空处发出裂帛之声，一条能够踏过的路正在其中显现。',
    preparation:
      '准备持续输出与应变手段。将心法、道装和灵兽的节奏配合起来，避免只靠单次爆发。',
  },
  tribulation_body: {
    title: '负岳承雷',
    name: '负岳雷鼋',
    threshold: '炼虚圆满 · 合体门前',
    place: '神念落回肉身，脚下却像压来一整座雷山。',
    opening:
      '元神与道体开始相合，往日能避入虚空的反震如今全落在血肉之上。一头巨鼋伏在雷潮里，背甲隆起，缓缓截住你的退路。',
    revelation:
      '负岳雷鼋由形神相合时积起的雷压所化。它不逐人，只把每一次冲击送回你的身体。合体所需的承载力，要在这份重量下真正生长出来。',
    line: '神可游天外，身须立尘中。接住。',
    response:
      '你将护脉药力送入四肢百骸，不再让元神独自抢先。巨鼋抬首，甲上雷纹一道接一道亮起；这一回，你让形神同时迎上去。',
    preparation:
      '此关考验长战与承压。除心法、道装外，也应打磨炼体与灵兽续航，别让前几次交锋耗尽后劲。',
  },
  inner_demon_grand: {
    title: '空匣问道',
    name: '抱匣枯猿',
    threshold: '合体圆满 · 大乘门前',
    place: '道途尽头有一只枯猿，紧紧抱着一口没有东西的匣子。',
    opening:
      '修为越深，舍不下的东西也越多。枯藤从记忆里抽出长臂，攀成一只老猿；它怀里的匣子明明空着，你却认出了自己最不愿失去之物。',
    revelation:
      '抱匣枯猿是积年执念借壳而生。它把守护变成占有，把求道变成惧怕终结。大乘需要容纳更广的天地，若仍将两手攥死，便再也接不住前路。',
    line: '这一路都是为它。如今放手，岂不是白走了？',
    response:
      '你看着那口空匣，没有否认曾经的珍重。清心药力让心神安定，你松开紧握的掌心。枯猿低吼，长臂缠来，它要你再一次抓住。',
    preparation:
      '执念擅长拖住节奏。需要成熟的攻守循环与灵兽协作，切忌让灵力早早耗尽。',
  },
  heavenly_tribulation_final: {
    title: '天衡问劫',
    name: '天衡残钟',
    threshold: '大乘圆满 · 渡劫门前',
    place: '云海之上，一口残钟垂在虚处。钟腔的留白，像一只睁开的眼。',
    opening:
      '你收拢形神，天地却忽然寂静。没有劫雷落下，只有一口破损古钟缓缓转向你，第一声钟响尚未传来，经脉便已感到沉重。',
    revelation:
      '天衡残钟是劫数将成时显出的衡量之象。它以钟声逐层叩问道体、元神与道心；踏入渡劫之前，你须证明这三者足以共同承受真正的天劫。',
    line: '此身、此念、此道，可同受一劫？',
    response:
      '护脉与清心的药力沉入形神。你回望走过的诸境，将所有散落的力量归为一处。残钟轻倾，那只无声的眼终于落在你身上。',
    preparation:
      '这是完整构筑的检验。将当阶心法、道装、炼体与灵兽都准备妥当，保持气血和灵力充足。',
  },
} satisfies Record<
  BreakthroughChallengeId,
  {
    title: string;
    name: string;
    threshold: string;
    place: string;
    opening: string;
    revelation: string;
    line: string;
    response: string;
    preparation: string;
  }
>;

export const BREAKTHROUGH_PERFORMANCES = Object.fromEntries(
  Object.entries(encounters).map(([id, encounter]) => [
    id,
    parsePerformanceScript({
      id: `breakthrough-${id}`,
      title: encounter.title,
      requires: [],
      cast: { adversary: { name: encounter.name } },
      cues: [
        {
          type: 'scene',
          src: `/assets/icons/breakthrough-${id}.webp`,
          alt: encounter.place,
          tone: 'stillness',
        },
        { type: 'title', kicker: encounter.threshold, text: encounter.title },
        { type: 'narration', text: encounter.opening },
        { type: 'narration', text: encounter.revelation },
        { type: 'line', speaker: 'adversary', text: encounter.line },
        { type: 'narration', text: encounter.response },
        { type: 'end', outcome: 'challenge' },
      ],
    }),
  ]),
) as Record<BreakthroughChallengeId, PerformanceScript>;

export function getBreakthroughPreparationHint(
  id: BreakthroughChallengeId,
): string {
  return encounters[id].preparation;
}
