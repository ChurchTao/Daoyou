import { STANDARD_SECT_PRESENTATION } from '@daoyou/game-content/sect-organization/standard/presentation';
import type {
  SectSceneKey,
  SectScenePresentation,
  SectRoomDefinition,
  SectPresentationTheme,
  ResolvedSectPresentation,
} from '@daoyou/game-domain/sects';

function assertNonBlank(label: string, value: string): void {
  if (!value.trim()) throw new Error(`${label}不能为空`);
}

export function resolveSectPresentation(
  sectId: string,
  theme?: Omit<SectPresentationTheme, 'announcement'> & {
    announcement?: string;
  },
): ResolvedSectPresentation {
  if (theme && theme.sectId !== sectId) {
    throw new Error(`宗门展示主题标识不一致：${theme.sectId} !== ${sectId}`);
  }
  const scenes = Object.fromEntries(
    (Object.keys(STANDARD_SECT_PRESENTATION.scenes) as SectSceneKey[]).map(
      (key) => [
        key,
        { ...STANDARD_SECT_PRESENTATION.scenes[key], ...theme?.scenes?.[key] },
      ],
    ),
  ) as Record<SectSceneKey, SectScenePresentation>;
  const map = {
    ...STANDARD_SECT_PRESENTATION.map,
    ...theme?.map,
    hotspots: theme?.map?.hotspots ?? STANDARD_SECT_PRESENTATION.map.hotspots,
  };
  const rooms = Object.fromEntries(
    Object.entries(STANDARD_SECT_PRESENTATION.rooms).map(
      ([roomKey, standardRoom]) => {
        const roomOverride = theme?.rooms?.[roomKey];
        const actors = standardRoom.actors.map((standardActor) => {
          const override = roomOverride?.actors?.[standardActor.roleKey];
          return {
            ...standardActor,
            id: override?.id ?? standardActor.id,
            name: override?.name ?? standardActor.name,
            greeting: override?.greeting ?? standardActor.greeting,
          };
        });
        return [
          roomKey,
          {
            ...standardRoom,
            description: roomOverride?.description ?? standardRoom.description,
            actors,
          },
        ];
      },
    ),
  ) as Record<string, SectRoomDefinition>;
  const resolved: ResolvedSectPresentation = {
    sectId,
    announcement:
      theme?.announcement ?? STANDARD_SECT_PRESENTATION.announcement,
    onboarding: theme?.onboarding,
    map,
    facilityLabels: {
      ...STANDARD_SECT_PRESENTATION.facilityLabels,
      ...theme?.facilityLabels,
    },
    lockedFacilities:
      theme?.lockedFacilities ?? STANDARD_SECT_PRESENTATION.lockedFacilities,
    scenes,
    rooms,
    terms: {
      ...STANDARD_SECT_PRESENTATION.terms,
      ...theme?.terms,
      sweepActivity: STANDARD_SECT_PRESENTATION.terms.sweepActivity,
      sweepCanvasLabel: STANDARD_SECT_PRESENTATION.terms.sweepCanvasLabel,
    },
  };

  assertNonBlank(`宗门 ${sectId} 公告`, resolved.announcement);
  for (const [key, value] of Object.entries(resolved.facilityLabels)) {
    assertNonBlank(`宗门 ${sectId} 设施 ${key} 名称`, value);
  }
  for (const [key, value] of Object.entries(resolved.scenes)) {
    for (const [field, text] of Object.entries(value)) {
      assertNonBlank(`宗门 ${sectId} 场景 ${key}.${field}`, text);
    }
  }
  for (const [key, value] of Object.entries(resolved.terms)) {
    assertNonBlank(`宗门 ${sectId} 术语 ${key}`, value);
  }
  for (const [roomKey, room] of Object.entries(resolved.rooms)) {
    assertNonBlank(`宗门 ${sectId} 房间 ${roomKey}.key`, room.key);
    assertNonBlank(
      `宗门 ${sectId} 房间 ${roomKey}.description`,
      room.description,
    );
    const actorIds = new Set<string>();
    const roleKeys = new Set<string>();
    for (const actor of room.actors) {
      if (actor.appearance !== 'person' && actor.appearance !== 'facility')
        throw new Error(
          `宗门 ${sectId} 房间 ${roomKey}.${actor.roleKey}.appearance 无效`,
        );
      for (const field of [
        'roleKey',
        'id',
        'sigil',
        'name',
        'identity',
        'responsibility',
        'greeting',
      ] as const) {
        assertNonBlank(
          `宗门 ${sectId} 房间 ${roomKey}.${actor.roleKey}.${field}`,
          actor[field],
        );
      }
      assertNonBlank(
        `宗门 ${sectId} 房间 ${roomKey}.${actor.roleKey}.renderer`,
        actor.conversation.renderer,
      );
      if (actorIds.has(actor.id))
        throw new Error(`宗门 ${sectId} 房间 ${roomKey} NPC ID 不可重复`);
      if (roleKeys.has(actor.roleKey))
        throw new Error(`宗门 ${sectId} 房间 ${roomKey} 角色标识不可重复`);
      actorIds.add(actor.id);
      roleKeys.add(actor.roleKey);
    }
  }
  for (const [roomKey, override] of Object.entries(theme?.rooms ?? {})) {
    const standard = STANDARD_SECT_PRESENTATION.rooms[roomKey];
    if (!standard) throw new Error(`宗门 ${sectId} 覆盖了未知房间：${roomKey}`);
    const roleKeys = new Set(standard.actors.map((actor) => actor.roleKey));
    for (const roleKey of Object.keys(override.actors ?? {})) {
      if (!roleKeys.has(roleKey))
        throw new Error(
          `宗门 ${sectId} 房间 ${roomKey} 覆盖了未知角色：${roleKey}`,
        );
    }
  }
  for (const facility of resolved.lockedFacilities) {
    assertNonBlank(`宗门 ${sectId} 锁定设施`, facility);
  }
  if (theme?.map?.image !== undefined) {
    assertNonBlank(`宗门 ${sectId} 地图资源`, theme.map.image);
  }
  if (resolved.onboarding) {
    assertNonBlank(`宗门 ${sectId} 入门摘要`, resolved.onboarding.summary);
    resolved.onboarding.traits.forEach((trait, index) =>
      assertNonBlank(`宗门 ${sectId} 入门特色 ${index}`, trait),
    );
    assertNonBlank(`宗门 ${sectId} 演出标识`, resolved.onboarding.script.id);
    assertNonBlank(`宗门 ${sectId} 演出标题`, resolved.onboarding.script.title);
    assertNonBlank(
      `宗门 ${sectId} 演出背景`,
      resolved.onboarding.script.backdrop.src,
    );
    assertNonBlank(
      `宗门 ${sectId} 演出背景替代文本`,
      resolved.onboarding.script.backdrop.alt,
    );
    if (!resolved.onboarding.script.acts.length) {
      throw new Error(`宗门 ${sectId} 入门演出至少需要一幕`);
    }
    for (const act of resolved.onboarding.script.acts) {
      assertNonBlank(`宗门 ${sectId} 演出幕标识`, act.id);
      assertNonBlank(`宗门 ${sectId} 演出幕名`, act.title);
      assertNonBlank(`宗门 ${sectId} 演出场景`, act.scene);
      assertNonBlank(`宗门 ${sectId} 演出正文`, act.body);
    }
  }
  if (theme?.map?.alt !== undefined) {
    assertNonBlank(`宗门 ${sectId} 地图替代文本`, theme.map.alt);
  }
  if (!Number.isFinite(map.aspectRatio) || map.aspectRatio <= 0) {
    throw new Error(`宗门 ${sectId} 地图宽高比无效`);
  }
  if (map.image) {
    if (!theme?.map?.alt?.trim() || !theme.map.hotspots?.length) {
      throw new Error(`宗门 ${sectId} 自定义地图必须提供完整热点配置`);
    }
  }
  for (const hotspot of map.hotspots) {
    assertNonBlank(`宗门 ${sectId} 地图热点 ID`, hotspot.id);
    assertNonBlank(`宗门 ${sectId} 地图热点名称`, hotspot.label);
    assertNonBlank(`宗门 ${sectId} 地图热点说明`, hotspot.note);
    assertNonBlank(`宗门 ${sectId} 地图热点横坐标`, hotspot.left);
    assertNonBlank(`宗门 ${sectId} 地图热点纵坐标`, hotspot.top);
    if (hotspot.route !== undefined) {
      assertNonBlank(`宗门 ${sectId} 地图热点路由`, hotspot.route);
    }
    if (hotspot.facility !== undefined) {
      assertNonBlank(`宗门 ${sectId} 地图热点设施`, hotspot.facility);
    }
  }
  if (
    new Set(map.hotspots.map((hotspot) => hotspot.id)).size !==
    map.hotspots.length
  ) {
    throw new Error(`宗门 ${sectId} 地图热点 ID 不可重复`);
  }
  return resolved;
}
