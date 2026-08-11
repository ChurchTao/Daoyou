const RESOURCE_ASSET_ROOT = '/assets/battle/realtime/ui/resources';

const RESOURCE_ASSETS: Readonly<Record<string, string>> = {
  'sect.lingxiao.sword-momentum': `${RESOURCE_ASSET_ROOT}/sword-momentum.png`,
  'sect.tianyan.derivation': `${RESOURCE_ASSET_ROOT}/derivation.png`,
  'sect.wuxiang.war-intent': `${RESOURCE_ASSET_ROOT}/heart-intent.png`,
  'sect.youdu.soul-fire': `${RESOURCE_ASSET_ROOT}/soul-fire.png`,
};

const GENERIC_RESOURCE_ASSET = `${RESOURCE_ASSET_ROOT}/generic-resource.png`;

const GENERIC_RESOURCE_TEXTURE = 'battle-resource-generic';

export interface RealtimeBattleResourceAsset {
  readonly resourceId?: string;
  readonly textureKey: string;
  readonly path: string;
}

const RESOURCE_TEXTURES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(RESOURCE_ASSETS).map((resourceId) => [
    resourceId,
    `battle-resource-${resourceId.split('.').join('-')}`,
  ]),
);

export function realtimeBattleResourceAssets(): readonly RealtimeBattleResourceAsset[] {
  return [
    ...Object.entries(RESOURCE_ASSETS).map(([resourceId, path]) => ({
      resourceId,
      textureKey: RESOURCE_TEXTURES[resourceId],
      path,
    })),
    {
      textureKey: GENERIC_RESOURCE_TEXTURE,
      path: GENERIC_RESOURCE_ASSET,
    },
  ];
}

export function realtimeBattleResourceTexture(resourceId: string): string {
  return RESOURCE_TEXTURES[resourceId] ?? GENERIC_RESOURCE_TEXTURE;
}
