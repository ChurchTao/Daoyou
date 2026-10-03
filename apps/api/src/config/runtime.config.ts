import { registerAs } from '@nestjs/config';
import { getRuntimeEnvironment } from '@server/lib/config/environment.js';

export const runtimeConfig = registerAs('runtime', () =>
  getRuntimeEnvironment(),
);
