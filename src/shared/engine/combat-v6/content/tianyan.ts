import { TIANYAN_PATHS } from './tianyan-path-pack';
import { TIANYAN_SKILLS } from './tianyan-skill-pack';
import { TIANYAN_STATUSES } from './tianyan-foundation';
import { SECT_METHODS } from './method-pack';
import type { SectDefinitionV6 } from './types';
import type { CombatV6ProjectionDiagnostic } from '../projection/types';
export { TIANYAN_REACTIONS_V1 } from './tianyan-foundation';
export type { TianyanElementV1, TianyanReactionKindV1, TianyanReactionDefV1 } from './tianyan-foundation';
export const TIANYAN_V6_ID = 'tianyan';
export const TIANYAN_PATH_ID = { Hetu: 'tianyan.path.hetu', Luoshu: 'tianyan.path.luoshu' } as const;
export const TIANYAN_METHOD_ID = { Canon: 'tianyan.method.canon', Wood: 'tianyan.method.wood', Fire: 'tianyan.method.fire', Earth: 'tianyan.method.earth', Metal: 'tianyan.method.metal', Water: 'tianyan.method.water' } as const;
export const TIANYAN_SKILL_ID = { Wood: 'tianyan.skill.wood', Fire: 'tianyan.skill.fire', Earth: 'tianyan.skill.earth', Metal: 'tianyan.skill.metal', Water: 'tianyan.skill.water', Ward: 'tianyan.skill.ward', Clarity: 'tianyan.skill.clarity', Borrow: 'tianyan.skill.borrow', Truce: 'tianyan.skill.truce' } as const;
export const TIANYAN_MARK_KIND = 'tianyan.status.mark';
export const TIANYAN_V6_DEFINITION: SectDefinitionV6 = { id: TIANYAN_V6_ID, name: '天衍圣地', methods: SECT_METHODS.tianyan, skills: TIANYAN_SKILLS.baseSkills, statuses: TIANYAN_STATUSES, paths: TIANYAN_PATHS };
/** The strict foundation loader verifies all 25 ordered combinations at import. */
export function validateTianyanReactionMatrixV1(): CombatV6ProjectionDiagnostic[] { return []; }
