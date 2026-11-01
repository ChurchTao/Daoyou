import type { SectDefinitionV6 } from '@daoyou/game-domain/combat';
import { SECT_METHODS } from './method-pack.js';
import { WANQIAO_COMBAT } from './wanqiao-pack.js';
import { WANQIAO_PATHS } from './wanqiao-path-pack.js';

export const WANQIAO_V6_ID = 'wanqiao' as const;
export const WANQIAO_PATH_ID = { Resonance: 'wanqiao.path.resonance', Subtlety: 'wanqiao.path.subtlety' } as const;
export const WANQIAO_METHOD_ID = { Canon: 'wanqiao.method.canon', Tone: 'wanqiao.method.tone', Undertone: 'wanqiao.method.undertone', Rest: 'wanqiao.method.rest', Hollow: 'wanqiao.method.hollow', Breath: 'wanqiao.method.breath' } as const;
export const WANQIAO_RESOURCE_ID = { Breath: 'wanqiao.resource.breath' } as const;
export const WANQIAO_SKILL_ID = {
  Chorus: 'wanqiao.skill.chorus', Pierce: 'wanqiao.skill.pierce', Fissure: 'wanqiao.skill.fissure', Silence: 'wanqiao.skill.silence', Echo: 'wanqiao.skill.echo', Blood: 'wanqiao.skill.blood', Rest: 'wanqiao.skill.rest', Hollow: 'wanqiao.skill.hollow', Harmony: 'wanqiao.skill.harmony', Undertone: 'wanqiao.skill.undertone', Catalyze: 'wanqiao.skill.catalyze', Distill: 'wanqiao.skill.distill', Resonate: 'wanqiao.skill.resonate', Coda: 'wanqiao.skill.coda',
} as const;
export const WANQIAO_STATUS_ID = {
  Echo: 'wanqiao.status.echo', Hollow: 'wanqiao.status.hollow', Harmony: 'wanqiao.status.harmony', Distill: 'wanqiao.status.distill', Vulnerable: 'wanqiao.status.vulnerable', Amplified: 'wanqiao.status.amplified', Flow: 'wanqiao.status.flow', Freeze: 'wanqiao.status.freeze', FreezePending: 'wanqiao.status.freeze_pending', SpellRest: 'wanqiao.status.spell_rest', SpellRestPending: 'wanqiao.status.spell_rest_pending',
} as const;

export const WANQIAO_V6_DEFINITION: SectDefinitionV6 = {
  id: WANQIAO_V6_ID, name: '万窍山', methods: SECT_METHODS.wanqiao,
  skills: WANQIAO_COMBAT.baseSkills, statuses: WANQIAO_COMBAT.statuses, paths: WANQIAO_PATHS,
};
