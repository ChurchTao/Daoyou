import { getSectRoomPortrait } from '@app/components/feature/sect/room/sectRoomPortrait';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import {
  fillPerformanceScript,
  type PerformanceContext,
  type PerformanceScript,
} from '@daoyou/game-domain/performance';

// 演出里按宗门换人的角色：填词的名字对应宗门哪间屋里的哪个人。
const SECT_CAST = {
  receptionist: ['hall', 'registry'],
  alchemy_teacher: ['alchemy', 'keeper'],
  forge_teacher: ['refinery', 'keeper'],
  instructor: ['arena', 'instructor'],
} as const;

/** 名字写成 {instructor} 这类填词的角色，在这个宗门里用谁的小像。 */
export function storyCastFace(
  name: string,
  sectId?: string | null,
): string | undefined {
  const key = /^\{(\w+)\}$/.exec(name)?.[1] as
    keyof typeof SECT_CAST | undefined;
  if (!sectId || !key || !(key in SECT_CAST)) return undefined;
  const [room, role] = SECT_CAST[key];
  const actor = getSectPresentation(sectId).rooms[room]?.actors.find(
    (entry) => entry.roleKey === role,
  );
  return actor ? getSectRoomPortrait(room, actor) : undefined;
}

/** 填好词的演出脚本。宗门里的人没写小像的，补上他在宗门房间里的那张。 */
export function fillStoryScript(
  script: PerformanceScript,
  context: PerformanceContext,
  sectId?: string | null,
): PerformanceScript {
  const filled = fillPerformanceScript(script, context);
  return {
    ...filled,
    cast: Object.fromEntries(
      Object.entries(filled.cast).map(([key, actor]) => [
        key,
        actor.portrait
          ? actor
          : {
              ...actor,
              portrait: storyCastFace(script.cast[key]?.name ?? '', sectId),
            },
      ]),
    ),
  };
}

export function storyPerformanceContext(
  cultivator: {
    name: string;
    background?: string | null;
    origin?: string | null;
  },
  sectId?: string | null,
): PerformanceContext {
  const rooms = sectId ? getSectPresentation(sectId).rooms : undefined;
  const actorName = (room: string, role: string, fallback: string) =>
    rooms?.[room]?.actors.find((actor) => actor.roleKey === role)?.name ??
    fallback;
  return {
    name: cultivator.name,
    background: cultivator.background?.trim() || '尚无来处',
    // 这具身体的出身。魂穿而来的人是从别人口中头一回听说。
    origin: cultivator.origin?.trim() || '来历不详',
    receptionist: actorName('hall', 'registry', '接引师兄'),
    alchemy_teacher: actorName('alchemy', 'keeper', '丹房执事'),
    forge_teacher: actorName('refinery', 'keeper', '器坊执事'),
    instructor: actorName('arena', 'instructor', '演武教习'),
  };
}
