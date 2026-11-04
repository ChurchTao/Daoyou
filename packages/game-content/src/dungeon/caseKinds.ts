/**
 * 解谜案型的玩家向介绍：秘境首页按节点列出“此地可能遇到的案子”。
 * 只写玩家进场前就该知道的事，不透露真相、角色暗线与变体；名称须与剧本模板一致。
 * 与完整的剧本模板分开，前端引用时不带入模板与保底案卷。
 */
export const MYSTERY_CASE_KINDS: Record<
  string,
  { name: string; pitch: string }
> = {
  inheritance_murder: {
    name: '遗府疑案',
    pitch: '前辈在洞府中离奇坐化。查明死因与凶手，判定传承该归何人。',
  },
  lost_relic: {
    name: '遗珍寻踪',
    pitch: '几拨人争寻前辈封存的遗珍。辨明真假线索，找出藏处与破禁之法。',
  },
  trial_seal: {
    name: '破禁试炼',
    pitch: '前辈留下试炼与禁制。解开机关、识破误导，推出主禁制的开启之法。',
  },
  anomaly_source: {
    name: '异变溯源',
    pitch: '此地异变丛生、日渐加剧。追查源头与祸首，在局面失控前设法平息。',
  },
  faction_choice: {
    name: '立场抉择',
    pitch: '两方势力在此对峙、各执一词。查清各自所图，再决定站在哪一边。',
  },
};
