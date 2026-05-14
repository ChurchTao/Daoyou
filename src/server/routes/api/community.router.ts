import { getResolvedCommunityQrcodeSourceUrl } from '@server/lib/repositories/appSettingsRepository';
import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';

function filenameForContentType(contentType: string | null): string {
  const base = 'daoyou-community-qrcode';
  if (!contentType) return `${base}.jpg`;
  if (contentType.includes('png')) return `${base}.png`;
  if (contentType.includes('webp')) return `${base}.webp`;
  if (contentType.includes('gif')) return `${base}.gif`;
  return `${base}.jpg`;
}

const router = new Hono<AppEnv>();

router.get('/qrcode', async (c) => {
  const shouldDownload = c.req.query('download') === '1';

  let sourceUrl: string;
  try {
    sourceUrl = await getResolvedCommunityQrcodeSourceUrl();
  } catch {
    return c.json({ success: false, error: '二维码配置暂不可用，请稍后重试' }, 503);
  }

  const upstream = await fetch(sourceUrl);

  if (!upstream.ok) {
    return c.json({ success: false, error: '二维码加载失败，请稍后重试' }, 502);
  }

  const image = await upstream.arrayBuffer();
  const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
  const filename = filenameForContentType(contentType);
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
  });

  return new Response(image, { status: 200, headers });
});

export default router;
