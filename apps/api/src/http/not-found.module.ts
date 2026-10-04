import { All, Controller, HttpCode, Module, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Access } from '../auth/access.js';

// These legacy routers authorized every method and child path, including misses.
// Keep the fallback module last so concrete feature routes always win.
@Controller()
@Access('active')
class ActiveNotFoundController {
  @All([
    'api/combat-v6{/{*path}}',
    'api/black-market{/{*path}}',
    'api/craft{/{*path}}',
    'api/divination{/{*path}}',
    'api/spirit-field{/{*path}}',
    'api/tower{/{*path}}',
    'api/hunts{/{*path}}',
    'api/artifact-migration{/{*path}}',
    'api/manual-migration{/{*path}}',
  ])
  @HttpCode(404)
  notFound(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    // These headers followed authorization in the former router middleware.
    if (/^\/api\/hunts(?:\/|$)/.test(request.path)) {
      response.setHeader('Cache-Control', 'private, no-store');
    } else if (
      /^\/api\/combat-v6\/(auto-strategy|manuals|sect|enlightenment|forging|inscriptions)(?:\/|$)/.test(
        request.path,
      )
    ) {
      response.setHeader('Cache-Control', 'no-store');
    }
    return { success: false, error: '接口不存在' };
  }
}

@Controller()
@Access('admin')
class AdminNotFoundController {
  @All([
    'api/admin/system-mails{/{*path}}',
    'api/admin/sponsorship{/{*path}}',
    'api/admin/tower-enemy-sets{/{*path}}',
  ])
  @HttpCode(404)
  notFound() {
    return { success: false, error: '接口不存在' };
  }
}

@Module({ controllers: [ActiveNotFoundController, AdminNotFoundController] })
export class NotFoundModule {}
