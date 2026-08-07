import type {
  BlackMarketNpcId,
  BlackMarketNpcSummary,
} from '@shared/types/blackMarket';

export interface BlackMarketNpcConfig extends Omit<
  BlackMarketNpcSummary,
  'status'
> {
  voice: string;
  opening: string;
  epilogue: string;
}

export const BLACK_MARKET_NPCS: readonly BlackMarketNpcConfig[] = [
  {
    id: 'smiling-keeper',
    sigil: '商',
    name: '笑面掌柜',
    identity: '暗巷掮客',
    responsibility: '袖口拢得严实，笑意始终看不出深浅',
    voice: '圆滑、热络、言语留三分，像在与熟客周旋',
    opening: '道友来得巧。此物不问出处，只问你敢不敢接。',
    epilogue: '掌柜笑意未减，只把袖口又拢紧了几分。',
  },
  {
    id: 'silent-elder',
    sigil: '鉴',
    name: '沉默老者',
    identity: '旧物鉴家',
    responsibility: '守着一件蒙尘旧物，话少得近乎吝啬',
    voice: '寡言、克制、专业，惜字如金',
    opening: '看可以。问也可以。看走眼，莫怨旁人。',
    epilogue: '老者看了你很久，最终什么也没说。',
  },
  {
    id: 'urgent-cultivator',
    sigil: '急',
    name: '急售散修',
    identity: '亡命货主',
    responsibility: '频频回望巷口，像是不愿在这里久留',
    voice: '急促、警惕、直来直往，不愿纠缠',
    opening: '别问我从哪弄的。看中就开价，我赶时间。',
    epilogue: '散修攥紧灵石，转眼便消失在暗巷尽头。',
  },
] as const;

export function getBlackMarketNpc(
  npcId: BlackMarketNpcId,
): BlackMarketNpcConfig {
  const npc = BLACK_MARKET_NPCS.find((candidate) => candidate.id === npcId);
  if (!npc) throw new Error(`未知黑市商人：${npcId}`);
  return npc;
}
