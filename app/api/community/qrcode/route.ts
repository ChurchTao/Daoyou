import { getResolvedCommunityQrcodeSourceUrl } from '@/lib/repositories/appSettingsRepository';

function filenameForContentType(contentType: string | null): string {
  const base = 'daoyou-community-qrcode';
  if (!contentType) return `${base}.jpg`;
  if (contentType.includes('png')) return `${base}.png`;
  if (contentType.includes('webp')) return `${base}.webp`;
  if (contentType.includes('gif')) return `${base}.gif`;
  return `${base}.jpg`;
}

/**
 * 代理群二维码图，避免跨域下载受限。上游 URL 由运营后台配置，无配置时回落为默认图地址。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldDownload = searchParams.get('download') === '1';

  let sourceUrl: string;
  try {
    sourceUrl = await getResolvedCommunityQrcodeSourceUrl();
  } catch {
    return Response.json(
      { success: false, error: '二维码配置暂不可用，请稍后重试' },
      { status: 503 },
    );
  }

  const upstream = await fetch(sourceUrl, {
    next: { revalidate: 3600 },
  });

  if (!upstream.ok) {
    return Response.json(
      { success: false, error: '二维码加载失败，请稍后重试' },
      { status: 502 },
    );
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
}
