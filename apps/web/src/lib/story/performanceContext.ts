import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import type { PerformanceContext } from '@daoyou/game-domain/performance';

export function storyPerformanceContext(
  cultivator: { name: string; background?: string | null },
  sectId?: string | null,
): PerformanceContext {
  const rooms = sectId ? getSectPresentation(sectId).rooms : undefined;
  const actorName = (room: string, role: string, fallback: string) =>
    rooms?.[room]?.actors.find((actor) => actor.roleKey === role)?.name ?? fallback;
  return {
    name: cultivator.name,
    background: cultivator.background?.trim() || '尚无来处',
    receptionist: actorName('hall', 'registry', '接引师兄'),
    alchemy_teacher: actorName('alchemy', 'keeper', '丹房执事'),
    forge_teacher: actorName('refinery', 'keeper', '器坊执事'),
    instructor: actorName('arena', 'instructor', '演武教习'),
  };
}
