import type { AtlasCategory } from '@shared/lib/game/mapAtlasCategories';

export const ATLAS_CATEGORY_STYLE = {
  wild: {
    name: '灵兽出没地',
    icon: 'icon:map-wild',
    color: 0x58694a,
    paper: 0xf0f2e5,
    badge: 0xd9e2c6,
    shape: 'round',
  },
  dungeon: {
    name: '秘境',
    icon: 'icon:map-dungeon',
    color: 0x6a5876,
    paper: 0xf3edf5,
    badge: 0xe1d4e8,
    shape: 'diamond',
  },
  market: {
    name: '坊市',
    icon: 'icon:map-market',
    color: 0x897039,
    paper: 0xf8f0dd,
    badge: 0xebd8ac,
    shape: 'square',
  },
  sect: {
    name: '宗门',
    icon: 'icon:map-sect',
    color: 0x416666,
    paper: 0xeaf3ed,
    badge: 0xc7ded3,
    shape: 'hexagon',
  },
  landmark: {
    name: '山川地标',
    icon: 'icon:map-landmark',
    color: 0x536877,
    paper: 0xecf0f3,
    badge: 0xd0dce4,
    shape: 'arch',
  },
} satisfies Record<
  AtlasCategory,
  {
    name: string;
    icon: string;
    color: number;
    paper: number;
    badge: number;
    shape: 'round' | 'diamond' | 'square' | 'hexagon' | 'arch';
  }
>;
