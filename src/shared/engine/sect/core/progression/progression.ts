import type {
  CultivatorSectState,
  SectAbilityId,
  SectDefinition,
} from '../domain';

/** 仅用于旧持久化神通栏水合校验，不参与 V6 解锁。 */
export function isAbilityUnlocked(
  definition: SectDefinition,
  abilityId: SectAbilityId,
  sect: CultivatorSectState,
): boolean {
  const ability = definition.abilities.find((entry) => entry.id === abilityId);
  if (!ability || sect.status !== 'active') return false;
  switch (ability.unlock.type) {
    case 'always':
      return true;
    case 'active_path':
      return sect.activePathId === ability.unlock.pathId;
    case 'method':
      return (
        (sect.methods[ability.unlock.methodId] ?? 0) >= ability.unlock.level
      );
  }
}
