import type { HuntBossId } from '@daoyou/game-domain/hunts';

export const HUNT_BOSSES = {
  heretic: {
    name: '噬灵邪修',
    icon: 'icon:cultivator-male-avatar',
    hint: '护法每回合都会替邪修疗伤。先封住护法的招式，或合力除去护法，便能断了他的援手。',
  },
  demon: {
    name: '六目古魔',
    icon: 'icon:beast-six-eyed-ape',
    hint: '魔眼盯上谁，古魔下一回合便会向谁挥出重击。被盯上的道友宜先防御，同伴可用保护或救援接应。',
  },
  beast: {
    name: '双生冥虎',
    icon: 'icon:beast-nether-tiger',
    hint: '双虎轮流为彼此施加护体，刀剑术法都难伤其身。可先驱散护体，或转攻另一只冥虎。',
  },
  bloodPython: {
    name: '血河妖蟒',
    icon: 'icon:beast-ink-jiao',
    hint: '妖蟒气血绵长，却无坚甲护身。先清除随从，再合力猛攻，留意长战中的疗伤与回灵。',
  },
  ironTurtle: {
    name: '铁背玄鼋',
    icon: 'icon:beast-snake-neck-turtle',
    hint: '铁背坚壳难受刀剑，却挡不住术法。擅长法术的道友主攻玄鼋，其余人先清理随从。',
  },
  mistToad: {
    name: '吞霞灵蟾',
    icon: 'icon:beast-golden-toad',
    hint: '灵蟾吞霞炼气，寻常术法难以奏效，肉身却不甚坚固。宜以刀剑近身破敌。',
  },
  gildedCorpse: {
    name: '金身尸王',
    icon: 'icon:cultivator-male-avatar',
    hint: '尸王金身不惧刀剑术法，内里气血却已枯竭。能直伤其身的固定伤害最为奏效。',
  },
  shadowMarten: {
    name: '掠影妖貂',
    icon: 'icon:beast-moon-marten',
    hint: '妖貂身法奇快，刀剑常落空。以法术攻它更稳，擅长必中招式的道友也可出手。',
  },
} as const satisfies Record<HuntBossId, { name: string; icon: string; hint: string }>;
