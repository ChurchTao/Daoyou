import { blackMarketUnit } from '@shared/lib/blackMarketRules';
import type { MaterialType } from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';

const MASKS: Record<MaterialType, Array<[string, string]>> = {
  seed: [
    ['封蜡种匣', '种匣封蜡完整，黑市规矩却不允许此类灵植种子流通。'],
  ],
  herb: [
    ['封泥药囊', '封泥已经龟裂，淡得几乎闻不出的药香仍未散尽。'],
    ['枯萎灵草束', '叶脉晦暗，偶尔有一线灵光从根须间游过。'],
  ],
  ore: [
    ['裂纹矿胚', '石皮粗粝斑驳，敲击时传来沉闷回音。'],
    ['裹泥金属块', '厚重泥壳遮住了内里，边角偶有冷芒一闪。'],
  ],
  monster: [
    ['缠布兽骨', '旧布下妖气驳杂，骨节的形制已经难辨。'],
    ['斑驳鳞片包', '鳞面黯淡失光，边缘却依旧锋利。'],
  ],
  tcdb: [
    ['蒙尘古盒', '盒身没有铭文，神识靠近时却隐有回鸣。'],
    ['无名灵物残块', '外表毫不起眼，重量却与体积并不相称。'],
  ],
  aux: [
    ['封蜡辅料罐', '蜡封年久开裂，罐内气息忽强忽弱。'],
    ['浑浊灵液瓶', '瓶中灵液层层分离，效用难以一眼分明。'],
  ],
  gongfa_manual: [
    ['虫蛀旧经卷', '纸页泛黄，断续字迹间似乎藏着周天图谱。'],
    ['封角残破典籍', '书脊多处开裂，翻动时仍有灵识微震。'],
  ],
  skill_manual: [
    ['残页秘术抄本', '笔意凌乱，几处完整法门被污迹遮住。'],
    ['无名术法残卷', '纸面残缺，未散的术意偶尔刺得人指尖发麻。'],
  ],
};

export function buildBlackMarketMask(
  item: Material,
  seed: string,
): { disguisedName: string; disguisedDescription: string } {
  const pool = MASKS[item.type];
  const selected =
    pool[Math.floor(blackMarketUnit(seed, 'mask') * pool.length)];
  return { disguisedName: selected[0], disguisedDescription: selected[1] };
}
