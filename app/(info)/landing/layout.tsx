import type { Metadata } from 'next';
import './landing.css';

export const metadata: Metadata = {
  title: '万界道友 | AIGC 驱动的文字修仙游戏 - 开源免费',
  description:
    '《万界道友》是一款以 AIGC 驱动的高自由度文字修仙游戏。觉醒灵根、修炼功法、探索秘境、挑战天骄，开启你独一无二的修仙之路。完全开源、永久免费。',
  keywords: [
    '修仙游戏',
    '文字游戏',
    'AIGC游戏',
    'AI游戏',
    '开源游戏',
    '修真',
    '放置游戏',
    'MUD',
    '万界道友',
  ],
  authors: [{ name: 'ChurchTao' }],
  openGraph: {
    title: '万界道友 | AIGC 驱动的文字修仙游戏',
    description:
      '以 AIGC 驱动的高自由度文字修仙游戏。觉醒灵根、修炼功法、探索秘境，开启你独一无二的修仙之路。',
    type: 'website',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary_large_image',
    title: '万界道友 | AIGC 驱动的文字修仙游戏',
    description: '以 AIGC 驱动的高自由度文字修仙游戏，完全开源、永久免费。',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
