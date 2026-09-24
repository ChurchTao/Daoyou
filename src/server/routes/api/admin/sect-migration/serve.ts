// Optional temporary entrypoint for the maintenance window. Importing app does
// not run src/index.ts, so no game scheduler or message consumers are started.
// The usual app entrypoint and middleware are untouched.
import app from '@server/app';

export default {
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3000),
  fetch(request: Request) {
    const path = new URL(request.url).pathname;
    if (
      path === '/api/admin/session' ||
      path === '/api/admin/sect-migration' ||
      path.startsWith('/api/admin/sect-migration/') ||
      path.startsWith('/api/auth/') ||
      path.startsWith('/api/captcha/')
    )
      return app.fetch(request);
    return Response.json(
      { error: '临时宗门迁移服务，仅开放管理工具' },
      { status: 503 },
    );
  },
};
