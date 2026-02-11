import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://daoyou.org';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/game/', // 游戏核心逻辑页面，需要登录
        '/api/', // API 接口
        '/create', // 角色创建页面（动态且通常需要初始状态）
        '/enter', // 进入游戏中间页
        '/login', // 登录页无需索引
        '/reincarnate', // 死亡/转世逻辑页
        '/admin', // 管理员页面
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
