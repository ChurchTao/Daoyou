import { InkUIProvider } from '@/components/providers/InkUIProvider';
import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: '万界道友｜AIGC 驱动的文字修仙游戏',
  description:
    '《万界道友》是一款以 AIGC 驱动、高自由度文字体验、修仙世界观为核心的开源游戏。在这里，你将以普通修士之身，借功法、灵根、神通、法宝与奇遇，一步步推演自己的修行之路。',
  icons: '/favicon.svg',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AuthProvider>
          <InkUIProvider>{children}</InkUIProvider>
        </AuthProvider>
      </body>
      <Analytics />
    </html>
  );
}
