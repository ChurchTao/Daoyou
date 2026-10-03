import type { SectModule } from '../plugin/index.js';
import { SectDefinitionRule } from './SectDefinitionRule.js';
import { ValidationPipeline } from './ValidationPipeline.js';

const pipeline = new ValidationPipeline<SectModule>([new SectDefinitionRule()]);

export function assertSectModule(module: SectModule): void {
  pipeline.validate(module);
}
