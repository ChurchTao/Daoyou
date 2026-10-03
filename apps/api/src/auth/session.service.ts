import { Injectable } from '@nestjs/common';
import { resolveActiveCultivatorRef } from '@server/lib/auth/activeCultivator.js';
import { auth } from '@server/lib/auth/auth.js';
import type { AuthUser } from '@server/lib/auth/types.js';

@Injectable()
export class SessionService {
  getSession(headers: Headers) {
    return auth.api.getSession({ headers, returnHeaders: true });
  }

  getActiveCultivator(user: AuthUser) {
    return resolveActiveCultivatorRef(user);
  }

  setPassword(headers: Headers, newPassword: string) {
    return auth.api.setPassword({ headers, body: { newPassword } });
  }
}
