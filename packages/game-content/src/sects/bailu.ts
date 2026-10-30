import type { SectDefinitionV6 } from '@daoyou/game-domain/combat';
import { BAILU_COMBAT } from './bailu-pack.js';
import { BAILU_PATHS } from './bailu-path-pack.js';
import { SECT_METHODS } from './method-pack.js';

export const BAILU_V6_ID = 'bailu' as const;
export const BAILU_PATH_ID = { Edict: 'bailu.path.edict', Song: 'bailu.path.song' } as const;
export const BAILU_METHOD_ID = { Canon: 'bailu.method.canon', Song: 'bailu.method.song', Edict: 'bailu.method.edict', Recovery: 'bailu.method.recovery', Bearing: 'bailu.method.bearing', Step: 'bailu.method.step' } as const;
export const BAILU_SKILL_ID = {
  Poxie: 'bailu.skill.poxie', Zhuxie: 'bailu.skill.zhuxie', Rumeng: 'bailu.skill.rumeng', Jinfa: 'bailu.skill.jinfa', Shihun: 'bailu.skill.shihun', Dingshen: 'bailu.skill.dingshen', Luanshen: 'bailu.skill.luanshen', Shicuo: 'bailu.skill.shicuo', Babing: 'bailu.skill.babing', Jinqi: 'bailu.skill.jinqi', Fuyuan: 'bailu.skill.fuyuan', Juqi: 'bailu.skill.juqi', Ningshen: 'bailu.skill.ningshen', Hushen: 'bailu.skill.hushen', Pojia: 'bailu.skill.pojia', Dianming: 'bailu.skill.dianming', Jinsheng: 'bailu.skill.jinsheng', Shesheng: 'bailu.skill.shesheng',
} as const;
export const BAILU_STATUS_ID = {
  Sleep: 'bailu.status.sleep', DeepSleep: 'bailu.status.sleep_deep', Law: 'bailu.status.law', Soul: 'bailu.status.soul', Still: 'bailu.status.still', Confusion: 'bailu.status.confusion', Disarray: 'bailu.status.disarray', Peace: 'bailu.status.peace', Device: 'bailu.status.device', Focus: 'bailu.status.focus', Guard: 'bailu.status.guard', Armor: 'bailu.status.armor', Mark: 'bailu.status.mark', Cage: 'bailu.status.cage', Verdict: 'bailu.status.verdict', Echo: 'bailu.status.echo', Weaken: 'bailu.status.weaken', Sacrifice: 'bailu.status.sacrifice', Charged: 'bailu.status.charged', Restrain: 'bailu.status.restrain',
} as const;

export const BAILU_V6_DEFINITION: SectDefinitionV6 = { id: BAILU_V6_ID, name: '白鹿书院', methods: SECT_METHODS.bailu, skills: BAILU_COMBAT.baseSkills, statuses: BAILU_COMBAT.statuses, paths: BAILU_PATHS };
