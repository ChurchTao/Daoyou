import type {
  CultivatorSectState,
  SectDefinition,
  SectMethodModifierProjection,
} from '../domain';

export function projectSectMethodModifiers(
  sect: CultivatorSectState | undefined,
  definition: SectDefinition,
): SectMethodModifierProjection[] {
  if (!sect || sect.status !== 'active' || sect.sectId !== definition.id)
    return [];
  return definition.methods.flatMap((method) => {
    const level = sect.methods[method.id] ?? 0;
    if (!method.modifierPerLevel || level <= 0) return [];
    return [
      {
        methodId: method.id,
        methodName: method.name,
        level,
        modifiers: [
          {
            ...method.modifierPerLevel,
            value: method.modifierPerLevel.value * level,
          },
        ],
      },
    ];
  });
}
