import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RuntimeEnvironment } from '@server/lib/config/environment.js';

@Injectable()
export class AppConfigService {
  private readonly environment: RuntimeEnvironment;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.environment = config.getOrThrow<RuntimeEnvironment>('runtime');
  }

  get<K extends keyof RuntimeEnvironment>(key: K): RuntimeEnvironment[K] {
    return this.environment[key];
  }
}
