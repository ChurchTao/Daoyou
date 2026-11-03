import type { SectDefinition } from '@daoyou/game-domain/sects';
import { WANQIAO_SECT_ID } from './ids.js';

/** 组织传承索引；技能解锁、流派与经脉以 V6 内容为准。 */
export const WANQIAO_DEFINITION: SectDefinition = {
  id: WANQIAO_SECT_ID,
  name: '万窍山',
  description:
    '山谷有洞，风才会鸣；竹管中空，才可以成笛。万窍山门人从石隙、竹窍与人的呼吸中听取天地之声，以听入道，以息成音。一声止处，正是另一声将起之处。',
  raceIds: ['human'],
  configVersion: 1,
  methods: [
    {
      id: 'wanqiao.method.canon',
      slot: 1,
      name: '《听万窍》',
      description: '初入山门，先学静听。石有隙，竹有窍，人的心念也须留出空处；待自己的声音静下来，才辨得清天地如何应答。',
      isPrimary: true,
    },
    {
      id: 'wanqiao.method.tone',
      slot: 2,
      name: '《风入松》',
      description: '风过松间，疏密自有声律。门人从中学会调音运息，将清声炼得有骨有锋，一声出手，轻重皆由心定。',
    },
    {
      id: 'wanqiao.method.undertone',
      slot: 3,
      name: '《弦外音》',
      description: '弦止之后，仍有一线声音未散。修者把这点余音留在气机细隙中，使它随呼吸回转；待旁人察觉，回声已深。',
    },
    {
      id: 'wanqiao.method.rest',
      slot: 4,
      name: '《月满空山》',
      description: '月照空山，草木无言。修者借这一分静意收拢散乱气息，慢慢养稳气血与筋骨；身中有了安处，行止便多一分安定。',
    },
    {
      id: 'wanqiao.method.hollow',
      slot: 5,
      name: '《虚舟》',
      description: '空舟能容物，虚心能应变。修者在来势之间留出转圜，让气息游走于身周，护得住自己，也不失从容。',
    },
    {
      id: 'wanqiao.method.breath',
      slot: 6,
      name: '《一息绵长》',
      description: '一呼一吸，细匀绵长。修者涵养胸中灵息，使一段声音止后，仍有余力续起下一段，与身旁的众声相和。',
    },
  ],
  abilities: [
    {
      // 满足组织传承的默认条目约束，不编入 V6 技能或学习目录。
      id: 'wanqiao.organization.listen',
      kind: 'default',
      baseName: '静听',
      description: '入山先听万窍，战斗中仍依当前已学神通行事。',
      role: 'utility',
      visibility: 'internal',
      unlock: { type: 'method', methodId: 'wanqiao.method.canon', level: 1 },
    },
    {
      id: 'wanqiao.skill.chorus',
      kind: 'active',
      baseName: '众窍鸣',
      description: '引山中众窍共鸣，以清声击向敌阵。',
      role: 'generator',
      unlock: { type: 'method', methodId: 'wanqiao.method.canon', level: 35 },
    },
    {
      id: 'wanqiao.skill.pierce',
      kind: 'active',
      baseName: '裂帛',
      description: '一声清越如裂帛，凝音攻向一名敌人。',
      role: 'finisher',
      unlock: { type: 'method', methodId: 'wanqiao.method.tone', level: 20 },
    },
    {
      id: 'wanqiao.skill.echo',
      kind: 'active',
      baseName: '留音',
      description: '将细微余音留在敌人气机中，使其反复回响。',
      role: 'utility',
      unlock: { type: 'method', methodId: 'wanqiao.method.undertone', level: 40 },
    },
    {
      id: 'wanqiao.skill.rest',
      kind: 'active',
      baseName: '息心',
      description: '收声敛息，调养自身气血。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'wanqiao.method.rest', level: 35 },
    },
    {
      id: 'wanqiao.skill.hollow',
      kind: 'active',
      baseName: '含虚',
      description: '以胸中灵息承接来势，化解自身所受伤害。',
      role: 'defensive',
      unlock: { type: 'method', methodId: 'wanqiao.method.hollow', level: 50 },
    },
    {
      id: 'wanqiao.passive.foundation',
      kind: 'passive',
      baseName: '空谷应声',
      description: '听风观窍，以绵长灵息应和余音。',
      role: 'utility',
      sourceMethodId: 'wanqiao.method.breath',
      unlock: { type: 'always' },
    },
  ],
  paths: [],
  onboarding: {
    initialContribution: 0,
    initialMethods: {
      'wanqiao.method.canon': 1,
      'wanqiao.method.tone': 1,
      'wanqiao.method.undertone': 1,
      'wanqiao.method.rest': 1,
      'wanqiao.method.hollow': 1,
      'wanqiao.method.breath': 1,
    },
    initialAbilityLoadout: [null, null, null, null],
  },
};
