const COMMUNITY_QR_CODE_SOURCE =
  'https://free.picui.cn/free/2026/02/24/699d3f0b15dd6.jpg';

/**
 * 代理 README 中的群二维码，避免跨域下载受限。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldDownload = searchParams.get('download') === '1';

  const upstream = await fetch(COMMUNITY_QR_CODE_SOURCE, {
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
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    'Content-Disposition': `${shouldDownload ? 'attachment' : 'inline'}; filename="daoyou-community-qrcode.jpg"`,
  });

  return new Response(image, { status: 200, headers });
}
