/**
 * 已交付的解谜立绘。键名与案卷中的 portrait（人物、守卫）或 manifest-类型（异变化形）一致；
 * 素材落到 public/assets/mystery/portraits 后在此登记，未登记的键显示姓氏印章。
 */
const DELIVERED_PORTRAITS = new Set<string>([
  'elder-m',
  'elder-f',
  'disciple-m',
  'disciple-f',
  'wanderer-m',
  'wanderer-f',
  'merchant-m',
  'merchant-f',
  'servant-m',
  'servant-f',
  'noble-m',
  'noble-f',
  'spirit',
  'yaoguai',
  'puppet',
  'manifest-grass',
  'manifest-earth',
  'manifest-water',
  'manifest-demonic',
  'manifest-corpse',
]);

export function mysteryPortraitUrl(key: string | undefined) {
  return key && DELIVERED_PORTRAITS.has(key)
    ? `/assets/mystery/portraits/${key}.webp`
    : undefined;
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
