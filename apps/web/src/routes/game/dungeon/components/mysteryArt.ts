import { GameIcon } from '@app/components/ui/GameIcon';

/** 案卷沿用原立绘键，页面通过游戏图标库取画。 */
export function mysteryPortraitIcon(key: string | undefined) {
  if (!key) return undefined;
  const icon = `icon:portrait-${key}`;
  return GameIcon.resolveSource(icon) ? icon : undefined;
}

/**
 * 已交付的场景插画，键名为地貌类别（DUNGEON_SCENE_KIND_VALUES）；
 * 素材落到 public/assets/mystery/scenes 后在此登记，未登记的类别不显示底图。
 */
const DELIVERED_SCENES = new Set<string>([
  'cave',
  'sect_ruin',
  'tomb',
  'tower_stele',
  'forest',
  'sea',
  'steppe',
  'void',
  'underground',
  'ice',
]);

export function mysterySceneUrl(kind: string | undefined) {
  return kind && DELIVERED_SCENES.has(kind)
    ? `/assets/mystery/scenes/${kind}.webp`
    : undefined;
}
